import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_login_accepts_email_identifier(api_client):
    user_model = get_user_model()
    user_model.objects.create_user(
        email="admin@example.com",
        password="secret123",
        full_name="Admin User",
    )

    response = api_client.post(
        "/api/v1/auth/login/",
        {"identifier": "admin@example.com", "password": "secret123"},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert "access" in payload
    assert "refresh" in payload


@pytest.mark.django_db
def test_login_accepts_username_identifier(api_client):
    user_model = get_user_model()
    user_model.objects.create_user(
        username="admin.user",
        email="admin@example.com",
        password="secret123",
        full_name="Admin User",
    )

    response = api_client.post(
        "/api/v1/auth/login/",
        {"identifier": "admin.user", "password": "secret123"},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert "access" in payload
    assert "refresh" in payload


@pytest.mark.django_db
def test_login_still_accepts_email_field_alias(api_client):
    user_model = get_user_model()
    user_model.objects.create_user(
        username="admin.user",
        email="admin@example.com",
        password="secret123",
        full_name="Admin User",
    )

    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": "admin.user", "password": "secret123"},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert "access" in payload
    assert "refresh" in payload


@pytest.mark.django_db
def test_login_fails_for_pending_user(api_client):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        username="pending.user",
        email="pending@example.com",
        password="secret123",
        status=user_model.Status.PENDING,
    )

    # Verify is_active is automatically False for pending users
    assert user.is_active is False
    assert user.has_platform_permission("users.view") is False

    response = api_client.post(
        "/api/v1/auth/login/",
        {"identifier": "pending@example.com", "password": "secret123"},
        format="json",
    )

    assert response.status_code == 400
    assert "non_field_errors" in response.json()
    assert response.json()["non_field_errors"][0] == "Không tìm thấy tài khoản đang hoạt động với thông tin đăng nhập đã cung cấp."
