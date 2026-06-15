import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework_simplejwt.tokens import RefreshToken

from .utils import build_active_session


@pytest.mark.django_db
def test_candidate_can_register_client_capability(api_client, subject, admin_user, candidate_user):
    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/capability/",
        {
            "client_type": "web",
            "client_version": "1.0.0",
            "capabilities": {"webcam": True, "screen_capture": True},
            "attestation_payload": {"fingerprint": "abc"},
            "user_agent": "Mozilla/5.0",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["client_type"] == "web"


@pytest.mark.django_db
def test_candidate_can_post_heartbeat(api_client, subject, admin_user, candidate_user, fake_redis):
    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/heartbeats/",
        {"connection_status": "stable", "latency_ms": 150, "payload": {"source": "browser"}},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["connection_status"] == "stable"


@pytest.mark.django_db
def test_candidate_can_post_proctor_event_and_evidence(api_client, subject, admin_user, candidate_user):
    from apps.proctoring.models import ProctorEvent

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    event_response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/events/",
        {
            "event_type": "tab_switch",
            "severity": "warning",
            "metadata": {"count": 2},
        },
        format="json",
    )
    assert event_response.status_code == 201
    event_id = event_response.json()["id"]

    evidence_response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/evidence/",
        {
            "event_id": event_id,
            "evidence_type": "screen_capture",
            "metadata": json.dumps({"resolution": "1920x1080"}),
            "file": SimpleUploadedFile("capture.png", b"png-bytes", content_type="image/png"),
        },
    )

    assert evidence_response.status_code == 201
    assert evidence_response.json()["evidence_type"] == "screen_capture"
    assert ProctorEvent.objects.get(id=event_id).violation_cases.count() == 1


@pytest.mark.django_db
def test_candidate_can_request_media_publish_token(api_client, subject, admin_user, candidate_user, fake_redis):
    from apps.proctoring.runtime import mark_live_request

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    mark_live_request(session_id=session.id, enabled=True, payload={"requested_by": admin_user.id})
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/media/publish-token/",
        {},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["participant_name"]


@pytest.mark.django_db
def test_candidate_can_report_media_status(api_client, subject, admin_user, candidate_user, fake_redis):
    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/media/status/",
        {
            "webcam_publish_status": "publishing",
            "screen_capture_status": "ready",
            "metadata": {"browser": "chromium"},
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["webcam_publish_status"] == "publishing"


@pytest.mark.django_db
def test_candidate_direct_upload_evidence_flow(api_client, subject, admin_user, candidate_user):
    from apps.proctoring.models import ProctorEvidence, ProctorEvent
    from django.core.files.storage import default_storage

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # 1. Request presigned URL
    url_response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/evidence/presigned-url/",
        {
            "evidence_type": "webcam_snapshot",
            "file_name": "evidence.jpg",
            "content_type": "image/jpeg",
        },
        format="json",
    )
    assert url_response.status_code == 200
    res_data = url_response.json()
    assert "upload_url" in res_data
    assert "object_key" in res_data
    
    upload_url = res_data["upload_url"]
    object_key = res_data["object_key"]
    
    # 2. Upload to mock endpoint using PUT
    binary_data = b"fake-jpg-data"
    mock_upload_response = api_client.put(
        upload_url,
        data=binary_data,
        content_type="image/jpeg",
    )
    assert mock_upload_response.status_code == 200
    
    # Verify file is stored in default_storage
    assert default_storage.exists(object_key)
    
    # 3. Create a proctor event first
    event_response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/events/",
        {
            "event_type": "tab_switch",
            "severity": "warning",
            "metadata": {"count": 1},
        },
        format="json",
    )
    assert event_response.status_code == 201
    event_id = event_response.json()["id"]

    # 4. Confirm upload
    confirm_response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/evidence/confirm/",
        {
            "event_id": event_id,
            "evidence_type": "webcam_snapshot",
            "object_key": object_key,
            "metadata": {"compressed": True},
        },
        format="json",
    )
    assert confirm_response.status_code == 201
    confirm_data = confirm_response.json()
    assert confirm_data["evidence_type"] == "webcam_snapshot"
    assert confirm_data["event"] == event_id
    
    # Check model instance
    evidence = ProctorEvidence.objects.get(id=confirm_data["id"])
    assert evidence.file.name == object_key
    assert evidence.event_id == event_id
    
    # Clean up file
    default_storage.delete(object_key)


@pytest.mark.django_db
def test_candidate_publish_token_overloaded_fallback(api_client, subject, admin_user, candidate_user, fake_redis, settings):
    from apps.proctoring.runtime import mark_live_request

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    mark_live_request(session_id=session.id, enabled=True, payload={"requested_by": admin_user.id})
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # Force resource overload
    settings.PROCTORING_FORCE_RESOURCE_OVERLOAD = True

    response = api_client.post(
        f"/api/v1/proctoring/sessions/{session.id}/media/publish-token/",
        {},
        format="json",
    )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["vps_overloaded"] is True
    assert res_data["access_token"] == ""
    assert res_data["provider"] == ""


