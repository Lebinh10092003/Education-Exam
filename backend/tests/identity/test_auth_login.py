import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext


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
def test_login_uses_single_user_lookup(api_client):
    user_model = get_user_model()
    user_model.objects.create_user(
        email="admin@example.com",
        password="secret123",
        full_name="Admin User",
    )

    with CaptureQueriesContext(connection) as context:
        response = api_client.post(
            "/api/v1/auth/login/",
            {"identifier": "admin@example.com", "password": "secret123"},
            format="json",
        )

    assert response.status_code == 200
    user_selects = [
        query
        for query in context.captured_queries
        if 'SELECT' in query["sql"] and 'FROM "identity_user"' in query["sql"]
    ]
    assert len(user_selects) == 1


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
def test_login_succeeds_for_pending_user_and_activates_them(api_client):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        username="pending.user",
        email="pending@example.com",
        password="secret123",
        status=user_model.Status.PENDING,
    )

    # Verify is_active is automatically True for pending users
    assert user.is_active is True
    assert user.has_platform_permission("users.view") is False

    response = api_client.post(
        "/api/v1/auth/login/",
        {"identifier": "pending@example.com", "password": "secret123"},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert "access" in payload
    assert "refresh" in payload

    # Verify user is now active
    user.refresh_from_db()
    assert user.status == user_model.Status.ACTIVE
