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
