import pytest
from django.core.cache import cache

from .utils import build_active_session


def _admin_alerts(admin_user):
    from apps.notifications.models import Notification

    return Notification.objects.filter(recipient=admin_user, category=Notification.Category.ALERT)


def _candidate_alerts(candidate_user):
    from apps.notifications.models import Notification

    return Notification.objects.filter(recipient=candidate_user, category=Notification.Category.ALERT)


@pytest.mark.django_db
def test_repeated_violation_reuses_open_case_and_escalates_once(settings, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event

    settings.PROCTORING_VIOLATION_COOLDOWN_SECONDS = 0
    settings.PROCTORING_VIOLATION_ESCALATE_AFTER = 3
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    events = [
        record_proctor_event(
            session=session,
            event_type="tab_switch",
            severity="warning",
            metadata={"message": f"switch {index}"},
            reported_by=candidate_user,
        )
        for index in range(4)
    ]

    assert len({event.id for event in events}) == 4
    cases = session.violation_cases.all()
    assert cases.count() == 1
    case = cases.get()
    assert case.events.count() == 4
    assert case.severity == "critical"
    # 1 thong bao khi mo case + 1 khi nang len critical (lan thu 3); lan 2 va 4 khong bao.
    assert _admin_alerts(admin_user).count() == 2
    assert _admin_alerts(admin_user).filter(priority="high").count() == 1
    # Thi sinh chi nhan 1 thong bao cho moi loai vi pham.
    assert _candidate_alerts(candidate_user).count() == 1


@pytest.mark.django_db
def test_different_violation_types_open_separate_cases(settings, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event

    settings.PROCTORING_VIOLATION_COOLDOWN_SECONDS = 0
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    record_proctor_event(session=session, event_type="tab_switch", severity="warning", reported_by=candidate_user)
    record_proctor_event(session=session, event_type="fullscreen_exit", severity="warning", reported_by=candidate_user)

    assert session.violation_cases.count() == 2
    assert _admin_alerts(admin_user).count() == 2


@pytest.mark.django_db
def test_resolved_case_is_not_reused(settings, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event

    settings.PROCTORING_VIOLATION_COOLDOWN_SECONDS = 0
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    first = record_proctor_event(session=session, event_type="tab_switch", severity="warning", reported_by=candidate_user)
    first.violation_cases.update(status="resolved")
    record_proctor_event(session=session, event_type="tab_switch", severity="warning", reported_by=candidate_user)

    assert session.violation_cases.count() == 2
    assert session.violation_cases.filter(status="open").count() == 1


@pytest.mark.django_db
def test_cooldown_collapses_rapid_duplicates_but_not_higher_severity(settings, subject, admin_user, candidate_user):
    from apps.proctoring.models import ProctorEvent
    from apps.proctoring.services import record_proctor_event

    cache.clear()
    settings.PROCTORING_VIOLATION_COOLDOWN_SECONDS = 30
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    first = record_proctor_event(session=session, event_type="tab_switch", severity="warning", reported_by=candidate_user)
    duplicate = record_proctor_event(session=session, event_type="tab_switch", severity="warning", reported_by=candidate_user)
    escalated = record_proctor_event(session=session, event_type="tab_switch", severity="critical", reported_by=candidate_user)
    other_type = record_proctor_event(
        session=session, event_type="fullscreen_exit", severity="warning", reported_by=candidate_user
    )

    assert duplicate.id == first.id
    assert escalated.id != first.id
    assert other_type.id not in {first.id, escalated.id}
    assert ProctorEvent.objects.filter(session=session).count() == 3
    cache.clear()


@pytest.mark.django_db
def test_candidate_notification_can_be_disabled(settings, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event

    settings.PROCTORING_VIOLATION_COOLDOWN_SECONDS = 0
    settings.PROCTORING_NOTIFY_CANDIDATE_ON_VIOLATION = False
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    record_proctor_event(session=session, event_type="tab_switch", severity="warning", reported_by=candidate_user)

    assert _candidate_alerts(candidate_user).count() == 0
    assert _admin_alerts(admin_user).count() == 1


def test_get_runtime_snapshots_batches_sessions(fake_redis):
    from apps.proctoring import runtime

    runtime.refresh_presence(session_id=7, exam_id=1, payload={"connection_status": "stable"})
    snapshots = runtime.get_runtime_snapshots([7, 8])

    assert snapshots[7]["presence"] == "online"
    assert snapshots[7]["connection_status"] == "stable"
    assert snapshots[7]["live_slot_active"] is False
    assert "presence" not in snapshots[8]
    assert runtime.get_runtime_snapshots([]) == {}
