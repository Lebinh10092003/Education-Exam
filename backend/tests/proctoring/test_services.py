from types import SimpleNamespace

import pytest
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .utils import build_active_session


def test_get_cached_exam_monitoring_snapshot_reuses_payload_within_ttl(settings, monkeypatch):
    from apps.proctoring import services

    settings.PROCTORING_MONITORING_SNAPSHOT_TTL_SECONDS = 10
    cache.clear()
    calls = []

    def fake_build_snapshot(*, exam):
        calls.append(exam.id)
        return {"exam": {"id": exam.id}, "candidate_statuses": []}

    monkeypatch.setattr(services, "build_exam_monitoring_snapshot", fake_build_snapshot)

    exam = SimpleNamespace(id=123)
    first = services.get_cached_exam_monitoring_snapshot(exam=exam)
    second = services.get_cached_exam_monitoring_snapshot(exam=exam)

    assert first == second
    assert calls == [123]


@pytest.mark.django_db
def test_register_client_capability_upserts_capability_for_session(subject, admin_user, candidate_user):
    from apps.proctoring.services import register_client_capability

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )

    capability = register_client_capability(
        session=session,
        client_type="web",
        client_version="1.0.0",
        capabilities={"webcam": True, "screen_capture": False},
        attestation_payload={"fingerprint": "abc"},
        user_agent="Mozilla/5.0",
    )

    assert capability.client_type == "web"
    assert capability.capabilities["webcam"] is True


@pytest.mark.django_db
def test_record_proctor_event_creates_violation_case_for_warning_events(subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )

    event = record_proctor_event(
        session=session,
        event_type="tab_switch",
        severity="warning",
        metadata={"count": 3},
        reported_by=candidate_user,
    )

    assert event.violation_cases.count() == 1
    assert event.violation_cases.first().status == "open"


@pytest.mark.django_db
def test_record_proctor_event_creates_admin_notification(
    django_capture_on_commit_callbacks,
    subject,
    admin_user,
    candidate_user,
):
    from apps.notifications.models import Notification
    from apps.proctoring.services import record_proctor_event

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )

    with django_capture_on_commit_callbacks(execute=True):
        event = record_proctor_event(
            session=session,
            event_type="fullscreen_exit",
            severity="critical",
            metadata={"count": 1, "message": "Candidate left fullscreen."},
            reported_by=candidate_user,
        )

    notification = Notification.objects.filter(
        recipient=admin_user,
        category=Notification.Category.ALERT,
        metadata__event_id=event.id,
    ).first()

    assert notification is not None
    assert notification.priority == Notification.Priority.HIGH
    assert notification.action_url == f"/exams/{exam.id}/monitor"


@pytest.mark.django_db
def test_record_proctor_event_creates_candidate_notification(
    django_capture_on_commit_callbacks,
    subject,
    admin_user,
    candidate_user,
):
    from apps.notifications.models import Notification
    from apps.proctoring.services import record_proctor_event

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )

    with django_capture_on_commit_callbacks(execute=True):
        event = record_proctor_event(
            session=session,
            event_type="tab_switch",
            severity="warning",
            metadata={"count": 1, "message": "Candidate switched away from the exam tab."},
            reported_by=candidate_user,
        )

    notification = Notification.objects.filter(
        recipient=candidate_user,
        category=Notification.Category.ALERT,
        metadata__event_id=event.id,
    ).first()

    assert notification is not None
    assert notification.priority == Notification.Priority.MEDIUM
    assert notification.action_url == "/candidate/notifications"
    assert notification.message == "Candidate switched away from the exam tab."


@pytest.mark.django_db
def test_build_exam_monitoring_snapshot_returns_candidate_statuses_and_alerts(
    subject,
    admin_user,
    candidate_user,
    fake_redis,
):
    from apps.proctoring.services import build_exam_monitoring_snapshot, record_heartbeat, record_proctor_event

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_heartbeat(
        session=session,
        connection_status="stable",
        latency_ms=120,
        payload={"source": "test"},
        reported_by=candidate_user,
    )
    record_proctor_event(
        session=session,
        event_type="tab_switch",
        severity="warning",
        metadata={"count": 1},
        reported_by=candidate_user,
    )

    snapshot = build_exam_monitoring_snapshot(exam=exam)

    assert snapshot["total_candidates"] >= 1
    assert snapshot["in_progress"] == 1
    assert snapshot["candidate_statuses"][0]["candidate"]["email"] == candidate_user.email
    assert snapshot["alerts"][0]["event_type"] == "tab_switch"


@pytest.mark.django_db
def test_build_exam_monitoring_snapshot_derives_connection_status_from_stale_runtime_presence(
    subject,
    admin_user,
    candidate_user,
    fake_redis,
):
    from apps.proctoring.services import build_exam_monitoring_snapshot, record_heartbeat

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_heartbeat(
        session=session,
        connection_status="stable",
        latency_ms=120,
        payload={"source": "test"},
        reported_by=candidate_user,
    )

    fake_redis.hashes[f"monitor:session:{session.id}"]["updated_at"] = (
        timezone.now() - timezone.timedelta(seconds=settings.PROCTORING_HEARTBEAT_UNSTABLE_AFTER_SECONDS + 1)
    ).isoformat()
    unstable_snapshot = build_exam_monitoring_snapshot(exam=exam)
    assert unstable_snapshot["candidate_statuses"][0]["connection_status"] == "unstable"

    fake_redis.hashes[f"monitor:session:{session.id}"]["updated_at"] = (
        timezone.now() - timezone.timedelta(seconds=settings.PROCTORING_HEARTBEAT_OFFLINE_AFTER_SECONDS + 1)
    ).isoformat()
    offline_snapshot = build_exam_monitoring_snapshot(exam=exam)
    assert offline_snapshot["candidate_statuses"][0]["connection_status"] == "offline"


@pytest.mark.django_db
def test_build_exam_monitoring_snapshot_keeps_time_up_session_in_grace_period(
    subject,
    admin_user,
    candidate_user,
    fake_redis,
):
    from apps.exam_delivery.models import ExamSession
    from apps.proctoring.services import build_exam_monitoring_snapshot, record_heartbeat

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    ExamSession.objects.filter(pk=session.pk).update(
        status=ExamSession.Status.IN_PROGRESS,
        expires_at=timezone.now() - timezone.timedelta(minutes=1),
    )
    record_heartbeat(
        session=session,
        connection_status="stable",
        latency_ms=120,
        payload={"source": "test"},
        reported_by=candidate_user,
    )

    snapshot = build_exam_monitoring_snapshot(exam=exam)
    session.refresh_from_db()

    # Het gio nhung con trong thoi gian an han nop bai: khong ghi DB, chi danh dau time_up.
    assert session.status == ExamSession.Status.IN_PROGRESS
    assert snapshot["candidate_statuses"][0]["status"] == "in_progress"
    assert snapshot["candidate_statuses"][0]["time_up"] is True


@pytest.mark.django_db
def test_build_exam_monitoring_snapshot_reports_non_active_sessions_as_offline(
    subject,
    admin_user,
    candidate_user,
    fake_redis,
):
    from apps.exam_delivery.models import ExamSession
    from apps.proctoring.services import build_exam_monitoring_snapshot, record_heartbeat

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    ExamSession.objects.filter(pk=session.pk).update(
        status=ExamSession.Status.SUBMITTED,
        submitted_at=timezone.now(),
    )
    record_heartbeat(
        session=session,
        connection_status="stable",
        latency_ms=120,
        payload={"source": "test"},
        reported_by=candidate_user,
    )

    snapshot = build_exam_monitoring_snapshot(exam=exam)

    assert snapshot["candidate_statuses"][0]["status"] == "submitted"
    assert snapshot["candidate_statuses"][0]["connection_status"] == "offline"


@pytest.mark.django_db
def test_resolve_violation_case_marks_case_resolved(subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event, resolve_violation_case

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    event = record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"count": 1},
        reported_by=candidate_user,
    )
    case = event.violation_cases.first()

    resolve_violation_case(
        case=case,
        reviewer=admin_user,
        decision="resolved",
        notes="Reviewed and accepted.",
    )
    case.refresh_from_db()

    assert case.status == "resolved"
    assert case.reviews.count() == 1


@pytest.mark.django_db
def test_register_client_capability_tolerates_broadcast_failures(
    caplog,
    monkeypatch,
    subject,
    admin_user,
    candidate_user,
):
    from apps.proctoring import services

    class FailingChannelLayer:
        async def group_send(self, *args, **kwargs):
            raise RuntimeError("Redis unavailable")

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    monkeypatch.setattr(services, "get_channel_layer", lambda: FailingChannelLayer())
    caplog.set_level("WARNING")
    monkeypatch.setattr(services, "_broadcast_warning_logged", False)

    capability = services.register_client_capability(
        session=session,
        client_type="web",
        client_version="1.0.0",
        capabilities={"webcam": True},
        attestation_payload={},
        user_agent="Mozilla/5.0",
    )

    assert capability.client_type == "web"
    assert "Unable to broadcast monitoring update" in caplog.text
    assert "Traceback" not in caplog.text


@pytest.mark.django_db
def test_broadcast_failures_only_log_once(monkeypatch, caplog, subject, admin_user, candidate_user, fake_redis):
    from apps.proctoring import services

    class FailingChannelLayer:
        async def group_send(self, *args, **kwargs):
            raise RuntimeError("Redis unavailable")

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    monkeypatch.setattr(services, "get_channel_layer", lambda: FailingChannelLayer())
    monkeypatch.setattr(services, "_broadcast_warning_logged", False)
    caplog.set_level("WARNING")

    services.record_heartbeat(
        session=session,
        connection_status="stable",
        latency_ms=10,
        payload={"source": "test"},
        reported_by=candidate_user,
    )
    services.record_heartbeat(
        session=session,
        connection_status="stable",
        latency_ms=11,
        payload={"source": "test"},
        reported_by=candidate_user,
    )

    assert caplog.text.count("Unable to broadcast monitoring update") == 1
