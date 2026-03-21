import pytest
from django.db import IntegrityError

from .utils import build_active_session


@pytest.mark.django_db
def test_client_capability_is_unique_per_session(subject, admin_user, candidate_user):
    from apps.proctoring.models import ClientCapability

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )

    ClientCapability.objects.create(
        session=session,
        client_type="web",
        client_version="1.0.0",
        capabilities={"webcam": True},
    )

    with pytest.raises(IntegrityError):
        ClientCapability.objects.create(
            session=session,
            client_type="web",
            client_version="1.0.1",
            capabilities={"screen": True},
        )


@pytest.mark.django_db
def test_violation_case_can_track_multiple_events(subject, admin_user, candidate_user):
    from apps.proctoring.models import ProctorEvent, ViolationCase

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    event_one = ProctorEvent.objects.create(
        session=session,
        event_type="tab_switch",
        severity="warning",
        metadata={"count": 1},
    )
    event_two = ProctorEvent.objects.create(
        session=session,
        event_type="fullscreen_exit",
        severity="warning",
        metadata={"count": 1},
    )
    case = ViolationCase.objects.create(
        session=session,
        severity="warning",
        title="Suspicious activity",
        summary="Multiple client-side warnings",
    )

    case.events.add(event_one, event_two)

    assert case.events.count() == 2

