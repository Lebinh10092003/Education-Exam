import logging
import uuid
import boto3
from django.urls import reverse

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.exam_authoring.models import Exam, ExamAssignment
from apps.exam_authoring.lifecycle import (
    exam_supports_live_monitoring,
    exam_supports_proctoring_runtime,
    resolve_exam_phase,
)
from apps.exam_delivery.models import ExamSession
from apps.notifications.models import Notification
from apps.notifications.services import create_notification, create_notifications_for_permission
from apps.platform_core.audit import record_audit_event
from apps.platform_core.i18n import t

from .media import get_media_provider
from .models import (
    ClientCapability,
    ProctorEvidence,
    ProctorEvent,
    ProctoringMediaState,
    SessionHeartbeat,
    ViolationCase,
    ViolationReview,
)
from .runtime import acquire_live_slot, get_runtime_snapshot, mark_live_request, refresh_presence, release_live_slot

logger = logging.getLogger(__name__)
_broadcast_warning_logged = False


def monitoring_group_name(exam_id):
    return f"monitoring_exam_{exam_id}"


def session_control_group_name(session_id):
    return f"proctoring_session_{session_id}"


def _broadcast_exam_monitoring_update(*, exam_id, message_type, payload):
    global _broadcast_warning_logged

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    try:
        async_to_sync(channel_layer.group_send)(
            monitoring_group_name(exam_id),
            {
                "type": "monitoring.message",
                "message_type": message_type,
                "payload": payload,
            },
        )
    except Exception:
        if not _broadcast_warning_logged:
            logger.warning(
                "Unable to broadcast monitoring update: channel layer is unavailable.",
                extra={"exam_id": exam_id, "message_type": message_type},
            )
            _broadcast_warning_logged = True


def _broadcast_session_control_update(*, session_id, message_type, payload):
    global _broadcast_warning_logged

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    try:
        async_to_sync(channel_layer.group_send)(
            session_control_group_name(session_id),
            {
                "type": "control.message",
                "message_type": message_type,
                "payload": payload,
            },
        )
    except Exception:
        if not _broadcast_warning_logged:
            logger.warning(
                "Unable to broadcast monitoring update: channel layer is unavailable.",
                extra={"session_id": session_id, "message_type": message_type},
            )
            _broadcast_warning_logged = True


def broadcast_session_phase_update(*, session):
    _broadcast_session_control_update(
        session_id=session.id,
        message_type="session_phase",
        payload={
            "phase": resolve_exam_phase(session.exam),
            "exam_id": session.exam_id,
        },
    )


def _event_message(event):
    return event.metadata.get("message") or event.get_event_type_display()


def _serialize_event(event):
    candidate = event.session.candidate
    case = event.violation_cases.order_by("-created_at").first()
    return {
        "id": event.id,
        "session_id": event.session_id,
        "candidate": {
            "id": candidate.id,
            "email": candidate.email,
            "full_name": candidate.full_name,
        },
        "event_type": event.event_type,
        "severity": event.severity,
        "message": _event_message(event),
        "metadata": event.metadata,
        "occurred_at": event.occurred_at.isoformat(),
        "case_id": case.id if case else None,
    }


def _serialize_case(case):
    candidate = case.session.candidate
    return {
        "id": case.id,
        "session_id": case.session_id,
        "candidate": {
            "id": candidate.id,
            "email": candidate.email,
            "full_name": candidate.full_name,
        },
        "severity": case.severity,
        "status": case.status,
        "title": case.title,
        "summary": case.summary,
        "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
    }


def _parse_runtime_timestamp(value):
    if not value:
        return None
    try:
        return timezone.datetime.fromisoformat(value)
    except ValueError:
        return None


def _assigned_candidates_for_exam(exam):
    user_model = get_user_model()
    return (
        user_model.objects.filter(
            Q(exam_assignments__exam=exam)
            | Q(group_memberships__group__exam_assignments__exam=exam, group_memberships__is_active=True)
        )
        .distinct()
        .order_by("email")
    )


def _latest_session_by_candidate(exam):
    sessions = (
        exam.sessions.select_related("candidate", "proctoring_media_state")
        .annotate(
            total_question_count=Count("questions", distinct=True),
            answered_question_count=Count(
                "questions",
                filter=Q(questions__answer__is_answered=True),
                distinct=True,
            ),
        )
        .order_by("candidate_id", "-attempt_number")
    )
    latest = {}
    for session in sessions:
        latest.setdefault(session.candidate_id, session)
    return latest


def _get_connection_timeout(setting_name, default_value):
    raw_value = getattr(settings, setting_name, default_value)
    try:
        return max(int(raw_value), 0)
    except (TypeError, ValueError):
        return default_value


def _resolve_runtime_connection_status(*, session, runtime_snapshot, now):
    if session.status != ExamSession.Status.IN_PROGRESS:
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    presence = runtime_snapshot.get("presence")
    if presence != "online":
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    updated_at = _parse_runtime_timestamp(runtime_snapshot.get("updated_at"))
    if updated_at is None:
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    unstable_after_seconds = _get_connection_timeout("PROCTORING_HEARTBEAT_UNSTABLE_AFTER_SECONDS", 90)
    offline_after_seconds = max(
        unstable_after_seconds,
        _get_connection_timeout("PROCTORING_HEARTBEAT_OFFLINE_AFTER_SECONDS", 150),
    )
    age = now - updated_at
    if age >= timezone.timedelta(seconds=offline_after_seconds):
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    reported_status = runtime_snapshot.get("connection_status") or SessionHeartbeat.ConnectionStatus.STABLE
    if (
        reported_status == SessionHeartbeat.ConnectionStatus.UNSTABLE
        or age >= timezone.timedelta(seconds=unstable_after_seconds)
    ):
        return SessionHeartbeat.ConnectionStatus.UNSTABLE
    return reported_status


def _resolve_session_connection_status(*, session, last_heartbeat, now):
    if last_heartbeat is None:
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    if session.status != ExamSession.Status.IN_PROGRESS:
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    if last_heartbeat.connection_status == SessionHeartbeat.ConnectionStatus.OFFLINE:
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    unstable_after_seconds = _get_connection_timeout("PROCTORING_HEARTBEAT_UNSTABLE_AFTER_SECONDS", 45)
    offline_after_seconds = max(
        unstable_after_seconds,
        _get_connection_timeout("PROCTORING_HEARTBEAT_OFFLINE_AFTER_SECONDS", 90),
    )
    heartbeat_age = now - last_heartbeat.recorded_at

    if heartbeat_age >= timezone.timedelta(seconds=offline_after_seconds):
        return SessionHeartbeat.ConnectionStatus.OFFLINE

    if (
        last_heartbeat.connection_status == SessionHeartbeat.ConnectionStatus.UNSTABLE
        or heartbeat_age >= timezone.timedelta(seconds=unstable_after_seconds)
    ):
        return SessionHeartbeat.ConnectionStatus.UNSTABLE

    return last_heartbeat.connection_status


def _sync_session_status_for_monitoring(*, session, now):
    if session.status == ExamSession.Status.IN_PROGRESS and session.expires_at <= now:
        session.status = ExamSession.Status.EXPIRED
        session.save(update_fields=["status", "updated_at"])
    return session.status


@transaction.atomic
def register_client_capability(
    *,
    session,
    client_type,
    client_version="",
    capabilities=None,
    attestation_payload=None,
    user_agent="",
):
    capability, _ = ClientCapability.objects.update_or_create(
        session=session,
        defaults={
            "client_type": client_type,
            "client_version": client_version,
            "capabilities": capabilities or {},
            "attestation_payload": attestation_payload or {},
            "user_agent": user_agent,
        },
    )
    _broadcast_exam_monitoring_update(
        exam_id=session.exam_id,
        message_type="client_capability",
        payload={
            "session_id": session.id,
            "candidate_id": session.candidate_id,
            "client_type": capability.client_type,
            "client_version": capability.client_version,
        },
    )
    return capability


def record_heartbeat(*, session, connection_status, latency_ms=None, payload=None, reported_by=None):
    if not exam_supports_proctoring_runtime(session.exam):
        raise ValidationError(
            t(
                vi="Bài thi này hiện không nhận trạng thái giám sát trực tiếp.",
                en="This exam is not currently accepting live proctoring runtime updates.",
            )
        )
    now = timezone.now()
    payload = payload or {}
    runtime_state = refresh_presence(
        session_id=session.id,
        exam_id=session.exam_id,
        payload={
            **payload,
            "connection_status": connection_status,
            "latency_ms": latency_ms,
        },
    )
    _broadcast_exam_monitoring_update(
        exam_id=session.exam_id,
        message_type="heartbeat",
        payload={
            "session_id": session.id,
            "candidate_id": session.candidate_id,
            "connection_status": connection_status,
            "latency_ms": latency_ms,
            "recorded_at": now.isoformat(),
        },
    )
    return {
        "session_id": session.id,
        "connection_status": connection_status,
        "latency_ms": latency_ms,
        "payload": payload,
        "recorded_at": runtime_state["state"]["updated_at"],
    }


@transaction.atomic
def record_proctor_event(*, session, event_type, severity="info", metadata=None, reported_by=None):
    if not exam_supports_proctoring_runtime(session.exam):
        raise ValidationError(
            t(
                vi="Bài thi này hiện không ghi nhận cảnh báo giám sát trực tiếp.",
                en="This exam is not currently recording live proctoring alerts.",
            )
        )
    event = ProctorEvent.objects.create(
        session=session,
        reported_by=reported_by,
        event_type=event_type,
        severity=severity,
        metadata=metadata or {},
    )
    admin_notification_kwargs = None
    candidate_notification_kwargs = None
    if severity in {ProctorEvent.Severity.WARNING, ProctorEvent.Severity.CRITICAL}:
        case = ViolationCase.objects.create(
            session=session,
            severity=severity,
            title=event.get_event_type_display(),
            summary=(metadata or {}).get("message", ""),
        )
        case.events.add(event)
        admin_notification_kwargs = {
            "permission_code": "proctoring.view",
            "title": f"Proctoring {severity} detected",
            "message": (
                f'{session.candidate.full_name or session.candidate.email} triggered '
                f'{event.get_event_type_display()} in "{session.exam.name}".'
            ),
            "category": Notification.Category.ALERT,
            "priority": (
                Notification.Priority.HIGH
                if severity == ProctorEvent.Severity.CRITICAL
                else Notification.Priority.MEDIUM
            ),
            "action_url": f"/exams/{session.exam_id}/monitor",
            "metadata": {
                "session_id": session.id,
                "exam_id": session.exam_id,
                "candidate_id": session.candidate_id,
                "event_id": event.id,
                "event_type": event.event_type,
                "severity": severity,
            },
        }
        candidate_notification_kwargs = {
            "recipient": session.candidate,
            "title": "Exam monitoring alert recorded",
            "message": (metadata or {}).get("message") or event.get_event_type_display(),
            "category": Notification.Category.ALERT,
            "priority": (
                Notification.Priority.HIGH
                if severity == ProctorEvent.Severity.CRITICAL
                else Notification.Priority.MEDIUM
            ),
            "action_url": "/candidate/notifications",
            "metadata": {
                "session_id": session.id,
                "exam_id": session.exam_id,
                "candidate_id": session.candidate_id,
                "event_id": event.id,
                "event_type": event.event_type,
                "severity": severity,
                "audience": "candidate",
            },
        }

    def publish_event_side_effects():
        if admin_notification_kwargs is not None:
            create_notifications_for_permission(**admin_notification_kwargs)
        if candidate_notification_kwargs is not None:
            create_notification(**candidate_notification_kwargs)
        _broadcast_exam_monitoring_update(
            exam_id=session.exam_id,
            message_type="proctor_event",
            payload=_serialize_event(event),
        )

    transaction.on_commit(publish_event_side_effects)
    return event


@transaction.atomic
def create_proctor_evidence(*, session, evidence_type, file, metadata=None, uploaded_by=None, event=None):
    evidence = ProctorEvidence.objects.create(
        session=session,
        event=event,
        uploaded_by=uploaded_by,
        evidence_type=evidence_type,
        file=file,
        metadata=metadata or {},
    )
    if event is not None:
        for case in event.violation_cases.all():
            case.evidences.add(evidence)
    _broadcast_exam_monitoring_update(
        exam_id=session.exam_id,
        message_type="evidence",
        payload={
            "id": evidence.id,
            "session_id": session.id,
            "candidate_id": session.candidate_id,
            "evidence_type": evidence.evidence_type,
            "captured_at": evidence.captured_at.isoformat(),
        },
    )
    return evidence


@transaction.atomic
def update_media_status(
    *,
    session,
    webcam_publish_status,
    screen_capture_status,
    metadata=None,
    webcam_publish_error="",
    provider=None,
    room_name="",
    participant_name="",
):
    now = timezone.now()
    runtime_snapshot = get_runtime_snapshot(session_id=session.id)
    media_state, _ = ProctoringMediaState.objects.get_or_create(
        session=session,
        defaults={"provider": provider or settings.PROCTORING_MEDIA_PROVIDER},
    )
    media_state.provider = provider or media_state.provider or settings.PROCTORING_MEDIA_PROVIDER
    if room_name:
        media_state.room_name = room_name
    if participant_name:
        media_state.participant_name = participant_name
    media_state.webcam_publish_status = webcam_publish_status
    media_state.screen_capture_status = screen_capture_status
    media_state.webcam_publish_error = webcam_publish_error
    media_state.last_status_at = now
    if webcam_publish_status == ProctoringMediaState.PublishStatus.PUBLISHING:
        media_state.last_publish_at = now
    media_state.metadata = {**media_state.metadata, **(metadata or {})}
    media_state.save()
    _broadcast_exam_monitoring_update(
        exam_id=session.exam_id,
        message_type="media_state",
        payload={
            "session_id": session.id,
            "candidate_id": session.candidate_id,
            "webcam_publish_status": media_state.webcam_publish_status,
            "screen_capture_status": media_state.screen_capture_status,
            "last_publish_at": media_state.last_publish_at.isoformat() if media_state.last_publish_at else None,
            "live_request_enabled": bool(runtime_snapshot.get("live_request", {}).get("enabled")),
            "live_slot_active": bool(runtime_snapshot.get("live_slot_active")),
        },
    )
    return media_state


def issue_candidate_publish_token(*, session, user):
    assert_candidate_session_access(session=session, user=user)
    if not exam_supports_proctoring_runtime(session.exam):
        raise PermissionDenied(
            t(
                vi="Webcam trực tiếp chỉ khả dụng khi kỳ thi đang mở.",
                en="Live webcam is only available while the exam is open.",
            )
        )
    runtime_snapshot = get_runtime_snapshot(session_id=session.id)
    if not runtime_snapshot.get("live_request", {}).get("enabled"):
        raise PermissionDenied(
            t(
                vi="Giám thị chưa yêu cầu xem webcam trực tiếp.",
                en="Live webcam has not been requested for this session.",
            )
        )
    payload = get_media_provider().build_publish_token(session=session, user=user)
    update_media_status(
        session=session,
        provider=payload["provider"],
        room_name=payload["room_name"],
        participant_name=payload["participant_name"],
        webcam_publish_status=ProctoringMediaState.PublishStatus.IDLE,
        screen_capture_status=ProctoringMediaState.CaptureStatus.UNAVAILABLE,
        metadata={"server_url": payload["server_url"]},
    )
    return payload


def issue_admin_view_token(*, session, user):
    assert_admin_monitoring_access(user=user)
    if not exam_supports_live_monitoring(session.exam):
        raise ValidationError(
            t(
                vi="Chỉ có thể xem trực tiếp khi kỳ thi đang mở.",
                en="Live view is only available while the exam is open.",
            )
        )
    if not acquire_live_slot(session_id=session.id, exam_id=session.exam_id):
        raise ValidationError(
            t(
                vi="Hiện không còn suất xem webcam trực tiếp khả dụng.",
                en="No live webcam slots are currently available.",
            )
        )
    live_request_state = mark_live_request(
        session_id=session.id,
        enabled=True,
        payload={
            "exam_id": session.exam_id,
            "requested_by": user.id,
        },
    )
    live_request_payload = get_runtime_snapshot(session_id=session.id).get(
        "live_request",
        live_request_state["state"],
    )
    _broadcast_session_control_update(
        session_id=session.id,
        message_type="live_request",
        payload=live_request_payload,
    )
    return get_media_provider().build_view_token(session=session, user=user)


def stop_admin_live_view(*, session, user):
    assert_admin_monitoring_access(user=user)
    live_request_state = mark_live_request(
        session_id=session.id,
        enabled=False,
        payload={
            "exam_id": session.exam_id,
            "requested_by": user.id,
        },
    )
    release_live_slot(session_id=session.id, exam_id=session.exam_id)
    live_request_payload = get_runtime_snapshot(session_id=session.id).get(
        "live_request",
        live_request_state["state"],
    )
    _broadcast_session_control_update(
        session_id=session.id,
        message_type="live_request",
        payload=live_request_payload,
    )


def _monitoring_snapshot_cache_key(exam_id):
    return f"proctoring:monitoring:snapshot:{exam_id}"


def get_cached_exam_monitoring_snapshot(*, exam):
    ttl_seconds = max(int(getattr(settings, "PROCTORING_MONITORING_SNAPSHOT_TTL_SECONDS", 10)), 0)
    if ttl_seconds == 0:
        return build_exam_monitoring_snapshot(exam=exam)

    cache_key = _monitoring_snapshot_cache_key(exam.id)
    payload = cache.get(cache_key)
    if payload is None:
        payload = build_exam_monitoring_snapshot(exam=exam)
        cache.set(cache_key, payload, ttl_seconds)
    return payload


def build_exam_monitoring_snapshot(*, exam):
    assigned_candidates = list(_assigned_candidates_for_exam(exam))
    latest_sessions = _latest_session_by_candidate(exam)
    candidate_statuses = []
    now = timezone.now()
    monitoring_active = exam_supports_live_monitoring(exam, now=now)
    exam_question_count = exam.current_version.items.count() if exam.current_version_id else 0

    for candidate in assigned_candidates:
        session = latest_sessions.get(candidate.id)
        if session is None:
            candidate_statuses.append(
                {
                    "session_id": None,
                    "candidate": {
                        "id": candidate.id,
                        "email": candidate.email,
                        "full_name": candidate.full_name,
                    },
                    "status": "not_started",
                    "progress_percentage": 0,
                    "questions_answered": 0,
                    "total_questions": exam_question_count,
                    "time_elapsed_minutes": 0,
                    "connection_status": "offline",
                    "last_activity_at": None,
                    "media": {
                        "webcam_publish_status": ProctoringMediaState.PublishStatus.IDLE,
                        "screen_capture_status": ProctoringMediaState.CaptureStatus.UNAVAILABLE,
                        "last_publish_at": None,
                    },
                }
            )
            continue

        total_questions = getattr(session, "total_question_count", 0)
        answered_count = getattr(session, "answered_question_count", 0)
        progress_percentage = int((answered_count / total_questions) * 100) if total_questions else 0
        session_status = _sync_session_status_for_monitoring(session=session, now=now)
        runtime_snapshot = get_runtime_snapshot(session_id=session.id)
        media_state = getattr(session, "proctoring_media_state", None)
        end_time = session.submitted_at or now
        connection_status = (
            _resolve_runtime_connection_status(
                session=session,
                runtime_snapshot=runtime_snapshot,
                now=now,
            )
            if monitoring_active
            else SessionHeartbeat.ConnectionStatus.OFFLINE
        )
        candidate_statuses.append(
            {
                "session_id": session.id,
                "candidate": {
                    "id": candidate.id,
                    "email": candidate.email,
                    "full_name": candidate.full_name,
                },
                "status": session_status,
                "progress_percentage": progress_percentage,
                "questions_answered": answered_count,
                "total_questions": total_questions,
                "time_elapsed_minutes": max(0, int((end_time - session.started_at).total_seconds() // 60)),
                "connection_status": connection_status,
                "last_activity_at": runtime_snapshot.get("updated_at")
                or (session.last_activity_at.isoformat() if session.last_activity_at else None),
                "media": {
                    "webcam_publish_status": (
                        media_state.webcam_publish_status
                        if media_state
                        else ProctoringMediaState.PublishStatus.IDLE
                    ),
                    "screen_capture_status": (
                        media_state.screen_capture_status
                        if media_state
                        else ProctoringMediaState.CaptureStatus.UNAVAILABLE
                    ),
                    "last_publish_at": (
                        media_state.last_publish_at.isoformat()
                        if media_state and media_state.last_publish_at
                        else None
                    ),
                    "live_request_enabled": (
                        bool(runtime_snapshot.get("live_request", {}).get("enabled")) if monitoring_active else False
                    ),
                    "live_slot_active": bool(runtime_snapshot.get("live_slot_active")) if monitoring_active else False,
                },
            }
        )

    alerts = (
        [
            _serialize_event(event)
            for event in ProctorEvent.objects.filter(
                session__exam=exam,
                severity__in=[ProctorEvent.Severity.WARNING, ProctorEvent.Severity.CRITICAL],
            )
            .select_related("session__candidate")
            .prefetch_related("violation_cases")
            .order_by("-occurred_at")[:20]
        ]
        if monitoring_active
        else []
    )

    total_candidates = len(candidate_statuses)
    in_progress = sum(1 for item in candidate_statuses if item["status"] == "in_progress")
    completed = sum(1 for item in candidate_statuses if item["status"] == "submitted")
    not_started = sum(1 for item in candidate_statuses if item["status"] == "not_started")
    average_progress = int(
        sum(item["progress_percentage"] for item in candidate_statuses) / total_candidates
    ) if total_candidates else 0

    return {
        "exam": {
            "id": exam.id,
            "name": exam.name,
            "subject_name": exam.subject.name,
        },
        "total_candidates": total_candidates,
        "in_progress": in_progress,
        "completed": completed,
        "not_started": not_started,
        "average_progress": average_progress,
        "candidate_statuses": candidate_statuses,
        "alerts": alerts,
    }


@transaction.atomic
def resolve_violation_case(*, case, reviewer, decision, notes="", request=None):
    if decision not in {ViolationReview.Decision.RESOLVED, ViolationReview.Decision.DISMISSED}:
        raise ValidationError(t(vi="Quyet dinh khong hop le.", en="Invalid decision."))

    review = ViolationReview.objects.create(
        case=case,
        reviewer=reviewer,
        decision=decision,
        notes=notes,
    )
    case.status = (
        ViolationCase.Status.RESOLVED
        if decision == ViolationReview.Decision.RESOLVED
        else ViolationCase.Status.DISMISSED
    )
    case.resolved_at = review.reviewed_at
    case.resolved_by = reviewer
    case.resolution_notes = notes
    case.save(update_fields=["status", "resolved_at", "resolved_by", "resolution_notes", "updated_at"])
    record_audit_event(
        actor=reviewer,
        action="proctoring.case_reviewed",
        category="proctoring",
        severity="warning" if decision == ViolationReview.Decision.RESOLVED else "info",
        description=f'Reviewed violation case #{case.id} for "{case.session.candidate.email}".',
        metadata={
            "case_id": case.id,
            "session_id": case.session_id,
            "exam_id": case.session.exam_id,
            "candidate_id": case.session.candidate_id,
            "decision": decision,
        },
        request=request,
    )
    _broadcast_exam_monitoring_update(
        exam_id=case.session.exam_id,
        message_type="violation_case",
        payload=_serialize_case(case),
    )
    return case


def assert_candidate_session_access(*, session, user):
    if session.candidate_id != user.id:
        raise PermissionDenied(
            t(vi="Bạn không có quyền truy cập phiên giám sát này.", en="You do not have access to this proctoring session.")
        )
    return session


def assert_admin_monitoring_access(*, user):
    if not user.is_authenticated or not user.has_platform_permission("proctoring.view"):
        raise PermissionDenied(
            t(vi="Bạn không có quyền theo dõi dữ liệu giám sát.", en="You do not have permission to monitor proctoring data.")
        )
    return user


def sanitize_path_segment(value: str) -> str:
    import re
    if not value:
        return "default"
    sanitized = re.sub(r'[\/\\:\*\?"<>\|]', '_', str(value))
    return sanitized.strip().strip('.') or "default"


def get_grade_folder_name(session) -> str:
    import re
    candidate = session.candidate
    profile = getattr(candidate, 'profile', None)
    student_class = getattr(profile, 'student_class', '') if profile else ''
    
    if student_class:
        match = re.match(r'^(\d+)', student_class.strip())
        if match:
            return f"Khối {match.group(1)}"
        return f"Khối {student_class.strip()}"
    return "Khối Khác"


def generate_evidence_presigned_url(*, session, evidence_type, file_name, content_type, request=None):
    ext = file_name.split('.')[-1] if '.' in file_name else 'jpg'
    
    subject_name = sanitize_path_segment(session.exam.subject.name)
    exam_name = sanitize_path_segment(session.exam.name)
    grade_folder = sanitize_path_segment(get_grade_folder_name(session))
    
    if session.started_at:
        exam_date = session.started_at.strftime("%Y-%m-%d")
    else:
        exam_date = timezone.now().strftime("%Y-%m-%d")
        
    candidate_username = sanitize_path_segment(session.candidate.username)
    unique_id = uuid.uuid4().hex
    unique_name = f"{candidate_username}_{unique_id}.{ext}"
    
    object_key = f"{subject_name}/{exam_name}/{grade_folder}/{exam_date}/{candidate_username}/{unique_name}"
    
    use_s3 = getattr(settings, 'USE_S3_STORAGE', False)
    if use_s3:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
            aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None),
            endpoint_url=getattr(settings, 'AWS_S3_ENDPOINT_URL', None),
            region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1'),
        )
        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
        upload_url = s3_client.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': bucket_name,
                'Key': object_key,
                'ContentType': content_type,
            },
            ExpiresIn=300
        )
    else:
        url_path = reverse('proctoring-session-evidence-mock-upload', kwargs={'session_id': session.id})
        if request:
            upload_url = request.build_absolute_uri(f"{url_path}?key={object_key}")
        else:
            upload_url = f"{url_path}?key={object_key}"
            
    return {
        "upload_url": upload_url,
        "object_key": object_key,
    }


@transaction.atomic
def confirm_evidence_upload(*, session, evidence_type, object_key, metadata=None, uploaded_by=None, event=None):
    evidence = ProctorEvidence(
        session=session,
        event=event,
        uploaded_by=uploaded_by,
        evidence_type=evidence_type,
        metadata=metadata or {},
    )
    evidence.file.name = object_key
    evidence.save()
    
    if event is not None:
        for case in event.violation_cases.all():
            case.evidences.add(evidence)
            
    _broadcast_exam_monitoring_update(
        exam_id=session.exam_id,
        message_type="evidence",
        payload={
            "id": evidence.id,
            "session_id": session.id,
            "candidate_id": session.candidate_id,
            "evidence_type": evidence.evidence_type,
            "captured_at": evidence.captured_at.isoformat(),
        },
    )
    return evidence

