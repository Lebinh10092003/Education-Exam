import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .utils import build_active_session


def _candidate_client(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


@pytest.mark.django_db
def test_presigned_url_rejects_non_image_extension(subject, admin_user, candidate_user):
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    client = _candidate_client(candidate_user)

    response = client.post(
        f"/api/v1/proctoring/sessions/{session.id}/evidence/presigned-url/",
        {"evidence_type": "webcam_snapshot", "file_name": "evil.html", "content_type": "text/html"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    "object_key",
    [
        "../../etc/passwd.jpg",
        "subject/exam/other_user/other_user_abc.jpg",
        "/absolute/path.jpg",
    ],
)
def test_mock_upload_rejects_foreign_or_unsafe_keys(subject, admin_user, candidate_user, object_key):
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    client = _candidate_client(candidate_user)

    response = client.put(
        f"/api/v1/proctoring/sessions/{session.id}/evidence/mock-upload/?key={object_key}",
        data=b"fake",
        content_type="image/jpeg",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_mock_upload_rejects_oversized_payload(settings, subject, admin_user, candidate_user):
    settings.PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES = 10
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    client = _candidate_client(candidate_user)

    presigned = client.post(
        f"/api/v1/proctoring/sessions/{session.id}/evidence/presigned-url/",
        {"evidence_type": "webcam_snapshot", "file_name": "evidence.jpg", "content_type": "image/jpeg"},
        format="json",
    ).json()

    response = client.put(presigned["upload_url"], data=b"x" * 100, content_type="image/jpeg")

    assert response.status_code == 413


@pytest.mark.django_db
def test_confirm_rejects_key_outside_candidate_folder(subject, admin_user, candidate_user):
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    client = _candidate_client(candidate_user)

    response = client.post(
        f"/api/v1/proctoring/sessions/{session.id}/evidence/confirm/",
        {"evidence_type": "webcam_snapshot", "object_key": "somebody/else/somebody_1.jpg"},
        format="json",
    )

    assert response.status_code == 400
