import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import load_workbook

from io import BytesIO

from .utils import build_active_session


@pytest.mark.django_db
def test_admin_can_fetch_exam_monitoring_snapshot(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.proctoring.services import record_heartbeat, update_media_status

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
    update_media_status(
        session=session,
        webcam_publish_status="publishing",
        screen_capture_status="ready",
        metadata={"provider": "livekit"},
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(f"/api/v1/proctoring/exams/{exam.id}/monitoring/")

    assert response.status_code == 200
    assert response.json()["total_candidates"] >= 1
    assert response.json()["candidate_statuses"][0]["candidate"]["email"] == candidate_user.email
    assert response.json()["candidate_statuses"][0]["session_id"] == session.id
    assert response.json()["candidate_statuses"][0]["media"]["webcam_publish_status"] == "publishing"


@pytest.mark.django_db
def test_admin_can_list_violation_cases(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.proctoring.services import create_proctor_evidence, record_proctor_event

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
    case = session.violation_cases.first()
    create_proctor_evidence(
        session=session,
        event=case.events.first(),
        evidence_type="webcam_snapshot",
        file=SimpleUploadedFile("webcam.png", b"img", content_type="image/png"),
        metadata={"source": "webcam"},
        uploaded_by=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get("/api/v1/proctoring/cases/")

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["status"] == "open"
    assert response.json()["results"][0]["evidence_items"][0]["evidence_type"] == "webcam_snapshot"


@pytest.mark.django_db
def test_admin_can_filter_violation_cases_by_exam_status_severity_and_search(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    from apps.proctoring.services import record_proctor_event

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"message": "Candidate exited fullscreen once."},
        reported_by=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(
        "/api/v1/proctoring/cases/",
        {
            "exam": exam.id,
            "status": "open",
            "severity": "critical",
            "search": candidate_user.full_name,
        },
    )

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["title"] == "Fullscreen Exit"


@pytest.mark.django_db
def test_admin_can_export_filtered_violation_cases_to_excel(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    from apps.proctoring.services import record_proctor_event

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"message": "Candidate exited fullscreen once."},
        reported_by=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(
        "/api/v1/proctoring/cases/export/",
        {"exam": exam.id, "status": "open", "severity": "critical"},
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    workbook = load_workbook(BytesIO(response.content))
    sheet = workbook.active
    assert sheet["A1"].value == "Case ID"
    assert sheet["B2"].value == exam.name
    assert sheet["D2"].value == candidate_user.full_name


@pytest.mark.django_db
def test_violation_export_requires_exam_scope(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get("/api/v1/proctoring/cases/export/")

    assert response.status_code == 400
    assert response.json()["detail"] == "exam is required."


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


@pytest.mark.django_db
def test_admin_can_request_view_token_for_candidate_session(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/media/view-token/",
        {},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["room_name"]

