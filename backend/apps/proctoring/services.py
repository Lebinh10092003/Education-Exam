import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.exam_authoring.models import Exam, ExamAssignment
from apps.notifications.models import Notification
from apps.notifications.services import create_notifications_for_permission
from apps.platform_core.audit import record_audit_event
from apps.platform_core.i18n import t

from .models import (
    ClientCapability,
    ProctorEvidence,
    ProctorEvent,
    SessionHeartbeat,
    ViolationCase,
    ViolationReview,
)

logger = logging.getLogger(__name__)
_broadcast_warning_logged = False


def monitoring_group_name(exam_id):
    return f"monitoring_exam_{exam_id}"


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
        exam.sessions.select_related("candidate")
        .prefetch_related("questions__answer", "heartbeats")
        .order_by("candidate_id", "-attempt_number")
    )
    latest = {}
    for session in sessions:
        latest.setdefault(session.candidate_id, session)
    return latest


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


@transaction.atomic
def record_heartbeat(*, session, connection_status, latency_ms=None, payload=None, reported_by=None):
    heartbeat = SessionHeartbeat.objects.create(
        session=session,
        reported_by=reported_by,
        connection_status=connection_status,
        latency_ms=latency_ms,
        payload=payload or {},
    )
    session.last_activity_at = timezone.now()
    session.save(update_fields=["last_activity_at", "updated_at"])
    _broadcast_exam_monitoring_update(
        exam_id=session.exam_id,
        message_type="heartbeat",
        payload={
            "session_id": session.id,
            "candidate_id": session.candidate_id,
            "connection_status": heartbeat.connection_status,
            "latency_ms": heartbeat.latency_ms,
            "recorded_at": heartbeat.recorded_at.isoformat(),
        },
    )
    return heartbeat


@transaction.atomic
def record_proctor_event(*, session, event_type, severity="info", metadata=None, reported_by=None):
    event = ProctorEvent.objects.create(
        session=session,
        reported_by=reported_by,
        event_type=event_type,
        severity=severity,
        metadata=metadata or {},
    )
    if severity in {ProctorEvent.Severity.WARNING, ProctorEvent.Severity.CRITICAL}:
        case = ViolationCase.objects.create(
            session=session,
            severity=severity,
            title=event.get_event_type_display(),
            summary=(metadata or {}).get("message", ""),
        )
        case.events.add(event)
        create_notifications_for_permission(
            permission_code="proctoring.view",
            title=f"Proctoring {severity} detected",
            message=(
                f'{session.candidate.full_name or session.candidate.email} triggered '
                f'{event.get_event_type_display()} in "{session.exam.name}".'
            ),
            category=Notification.Category.ALERT,
            priority=Notification.Priority.HIGH if severity == ProctorEvent.Severity.CRITICAL else Notification.Priority.MEDIUM,
            action_url=f"/exams/{session.exam_id}/monitor",
            metadata={
                "session_id": session.id,
                "exam_id": session.exam_id,
                "candidate_id": session.candidate_id,
                "event_id": event.id,
                "event_type": event.event_type,
                "severity": severity,
            },
        )
    _broadcast_exam_monitoring_update(
        exam_id=session.exam_id,
        message_type="proctor_event",
        payload=_serialize_event(event),
    )
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


def build_exam_monitoring_snapshot(*, exam):
    assigned_candidates = list(_assigned_candidates_for_exam(exam))
    latest_sessions = _latest_session_by_candidate(exam)
    candidate_statuses = []

    for candidate in assigned_candidates:
        session = latest_sessions.get(candidate.id)
        if session is None:
            candidate_statuses.append(
                {
                    "candidate": {
                        "id": candidate.id,
                        "email": candidate.email,
                        "full_name": candidate.full_name,
                    },
                    "status": "not_started",
                    "progress_percentage": 0,
                    "questions_answered": 0,
                    "total_questions": exam.current_version.items.count() if exam.current_version_id else 0,
                    "time_elapsed_minutes": 0,
                    "connection_status": "offline",
                    "last_activity_at": None,
                }
            )
            continue

        total_questions = session.questions.count()
        answered_count = session.questions.filter(answer__is_answered=True).count()
        progress_percentage = int((answered_count / total_questions) * 100) if total_questions else 0
        last_heartbeat = session.heartbeats.order_by("-recorded_at").first()
        end_time = session.submitted_at or timezone.now()
        candidate_statuses.append(
            {
                "candidate": {
                    "id": candidate.id,
                    "email": candidate.email,
                    "full_name": candidate.full_name,
                },
                "status": session.status,
                "progress_percentage": progress_percentage,
                "questions_answered": answered_count,
                "total_questions": total_questions,
                "time_elapsed_minutes": max(0, int((end_time - session.started_at).total_seconds() // 60)),
                "connection_status": last_heartbeat.connection_status if last_heartbeat else "offline",
                "last_activity_at": session.last_activity_at.isoformat() if session.last_activity_at else None,
            }
        )

    alerts = [
        _serialize_event(event)
        for event in ProctorEvent.objects.filter(
            session__exam=exam,
            severity__in=[ProctorEvent.Severity.WARNING, ProctorEvent.Severity.CRITICAL],
        )
        .select_related("session__candidate")
        .prefetch_related("violation_cases")
        .order_by("-occurred_at")[:20]
    ]

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
