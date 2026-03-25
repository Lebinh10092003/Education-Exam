import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import load_workbook

from io import BytesIO

from .utils import build_active_session


@pytest.mark.django_db
def test_admin_can_fetch_exam_monitoring_hub(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.identity.models import User
    from apps.proctoring.services import record_proctor_event

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        exam_name="Calculus Monitoring",
    )
    exam.enable_proctoring = True
    exam.status = "open"
    exam.save(update_fields=["enable_proctoring", "status", "updated_at"])

    quiet_candidate = User.objects.create_user(
        username="quietcandidate",
        email="quietcandidate@example.com",
        password="admin123456",
        full_name="Quiet Candidate",
        status="active",
    )
    quiet_exam, _ = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=quiet_candidate,
        exam_name="Quiet Monitoring",
    )
    quiet_exam.enable_proctoring = True
    quiet_exam.status = "paused"
    quiet_exam.save(update_fields=["enable_proctoring", "status", "updated_at"])

    record_proctor_event(
        session=session,
        event_type="tab_switch",
        severity="warning",
        metadata={"message": "Candidate switched tabs."},
        reported_by=candidate_user,
    )
    record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"message": "Candidate exited fullscreen."},
        reported_by=candidate_user,
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/proctoring/exams/monitoring/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["summary"] == {
        "exam_count": 1,
        "total_candidates": 1,
        "in_progress_sessions": 1,
        "alert_count": 2,
        "critical_exam_count": 1,
    }
    first_result = payload["results"][0]
    assert first_result["name"] == "Calculus Monitoring"
    assert first_result["total_candidates"] == 1
    assert first_result["in_progress_sessions"] == 1
    assert first_result["alert_count"] == 2
    assert first_result["critical_alert_count"] == 1
    assert first_result["highest_alert_severity"] == "critical"


@pytest.mark.django_db
def test_exam_monitoring_hub_supports_filters(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.identity.models import User
    from apps.proctoring.services import record_proctor_event

    critical_exam, critical_session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        exam_name="Physics Critical Room",
    )
    critical_exam.enable_proctoring = True
    critical_exam.status = "open"
    critical_exam.save(update_fields=["enable_proctoring", "status", "updated_at"])
    record_proctor_event(
        session=critical_session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"message": "Critical alert."},
        reported_by=candidate_user,
    )

    quiet_candidate = User.objects.create_user(
        username="searchcandidate",
        email="searchcandidate@example.com",
        password="admin123456",
        full_name="Search Candidate",
        status="active",
    )
    quiet_exam, _ = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=quiet_candidate,
        exam_name="Chemistry Quiet Room",
    )
    quiet_exam.enable_proctoring = True
    quiet_exam.status = "paused"
    quiet_exam.save(update_fields=["enable_proctoring", "status", "updated_at"])

    warning_candidate = User.objects.create_user(
        username="warningcandidate",
        email="warningcandidate@example.com",
        password="admin123456",
        full_name="Warning Candidate",
        status="active",
    )
    warning_exam, warning_session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=warning_candidate,
        exam_name="Biology Warning Room",
    )
    warning_exam.enable_proctoring = True
    warning_exam.status = "open"
    warning_exam.save(update_fields=["enable_proctoring", "status", "updated_at"])
    record_proctor_event(
        session=warning_session,
        event_type="tab_switch",
        severity="warning",
        metadata={"message": "Warning alert."},
        reported_by=warning_candidate,
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    critical_response = api_client.get("/api/v1/proctoring/exams/monitoring/", {"severity": "critical"})
    assert critical_response.status_code == 200
    assert critical_response.json()["count"] == 1
    assert critical_response.json()["results"][0]["name"] == "Physics Critical Room"

    warning_response = api_client.get("/api/v1/proctoring/exams/monitoring/", {"severity": "warning"})
    assert warning_response.status_code == 200
    assert warning_response.json()["count"] == 1
    assert warning_response.json()["results"][0]["name"] == "Biology Warning Room"

    quiet_response = api_client.get("/api/v1/proctoring/exams/monitoring/", {"severity": "quiet", "status": "paused"})
    assert quiet_response.status_code == 200
    assert quiet_response.json()["count"] == 1
    assert quiet_response.json()["results"][0]["name"] == "Chemistry Quiet Room"

    search_response = api_client.get("/api/v1/proctoring/exams/monitoring/", {"search": "physics"})
    assert search_response.status_code == 200
    assert search_response.json()["count"] == 1
    assert search_response.json()["results"][0]["name"] == "Physics Critical Room"


@pytest.mark.django_db
def test_admin_can_fetch_exam_monitoring_snapshot(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
    fake_redis,
):
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
    fake_redis,
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

    release_response = api_client.delete(
        f"/api/v1/proctoring/sessions/{session.id}/media/view-token/",
    )
    assert release_response.status_code == 204

