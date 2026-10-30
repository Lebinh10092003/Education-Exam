from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient


def _bearer(raw):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")
    return client


@pytest.mark.django_db
def test_admin_creates_token_once_and_uses_it_instead_of_password(api_client, admin_token, admin_user):
    from apps.identity.models import ApiToken

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    created = api_client.post("/api/v1/api-tokens/", {"name": "Claude laptop"}, format="json").json()
    raw = created["token"]
    assert raw.startswith("eduexam_pat_")
    assert ApiToken.objects.get(id=created["id"]).key_hash != raw  # chi luu ban bam

    profile = _bearer(raw).get("/api/v1/profile/")
    assert profile.status_code == 200
    assert profile.json()["email"] == admin_user.email

    listed = api_client.get("/api/v1/api-tokens/").json()
    assert listed[0]["name"] == "Claude laptop"
    assert "token" not in listed[0]
    assert ApiToken.objects.get(id=created["id"]).last_used_at is not None


@pytest.mark.django_db
def test_revoked_expired_and_locked_tokens_are_rejected(api_client, admin_token, admin_user):
    from apps.identity.api_tokens import create_api_token

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    created = api_client.post("/api/v1/api-tokens/", {"name": "tạm"}, format="json").json()
    assert api_client.delete(f"/api/v1/api-tokens/{created['id']}/").status_code == 204
    assert _bearer(created["token"]).get("/api/v1/profile/").status_code == 401

    token, raw = create_api_token(user=admin_user, name="cũ", expires_in_days=1)
    token.expires_at = timezone.now() - timedelta(minutes=1)
    token.save()
    assert _bearer(raw).get("/api/v1/profile/").status_code == 401

    _, raw_locked = create_api_token(user=admin_user, name="khoá")
    admin_user.status = "locked"
    admin_user.save(update_fields=["status"])
    assert _bearer(raw_locked).get("/api/v1/profile/").status_code == 401
    assert _bearer("eduexam_pat_khong-ton-tai").get("/api/v1/profile/").status_code == 401


@pytest.mark.django_db
def test_candidates_cannot_create_tokens(api_client, candidate_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(candidate_user).access_token}")
    assert api_client.post("/api/v1/api-tokens/", {"name": "x"}, format="json").status_code == 403


@pytest.mark.django_db
def test_users_only_see_their_own_tokens(api_client, admin_user, permission_grant):
    from django.contrib.auth import get_user_model

    from apps.identity.api_tokens import create_api_token

    other = get_user_model().objects.create_user(email="other@x.vn", password="secret123", full_name="Khác", is_staff=True)
    token, _ = create_api_token(user=other, name="của người khác")
    _, mine = create_api_token(user=admin_user, name="của tôi")
    client = _bearer(mine)

    assert [item["name"] for item in client.get("/api/v1/api-tokens/").json()] == ["của tôi"]
    assert client.delete(f"/api/v1/api-tokens/{token.id}/").status_code == 404


@pytest.mark.django_db
def test_management_command_prints_token(admin_user):
    out = StringIO()
    call_command("create_api_token", "--user", admin_user.email, "--name", "VPS", stdout=out)
    raw = [line for line in out.getvalue().splitlines() if line.startswith("eduexam_pat_")][0]
    assert _bearer(raw).get("/api/v1/profile/").status_code == 200
