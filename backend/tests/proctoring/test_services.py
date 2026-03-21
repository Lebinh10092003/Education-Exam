import pytest

from .utils import build_active_session


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
def test_build_exam_monitoring_snapshot_returns_candidate_statuses_and_alerts(subject, admin_user, candidate_user):
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

    capability = services.register_client_capability(
        session=session,
        client_type="web",
        client_version="1.0.0",
        capabilities={"webcam": True},
        attestation_payload={},
        user_agent="Mozilla/5.0",
    )

    assert capability.client_type == "web"
