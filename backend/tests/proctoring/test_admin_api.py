import pytest

from .utils import build_active_session


@pytest.mark.django_db
def test_admin_can_fetch_exam_monitoring_snapshot(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_heartbeat

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_heartbeat(
        session=session,
        connection_status="stable",
        latency_ms=80,
        payload={"source": "browser"},
        reported_by=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(f"/api/v1/proctoring/exams/{exam.id}/monitoring/")

    assert response.status_code == 200
    assert response.json()["total_candidates"] >= 1
    assert response.json()["candidate_statuses"][0]["candidate"]["email"] == candidate_user.email


@pytest.mark.django_db
def test_admin_can_list_violation_cases(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"count": 1},
        reported_by=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get("/api/v1/proctoring/cases/")

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["status"] == "open"


@pytest.mark.django_db
def test_admin_can_resolve_violation_case(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_proctor_event

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
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        f"/api/v1/proctoring/cases/{case.id}/resolve/",
        {"decision": "resolved", "notes": "Reviewed."},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "resolved"

