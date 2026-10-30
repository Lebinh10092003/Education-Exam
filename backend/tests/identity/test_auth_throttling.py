import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
@override_settings(AUTH_LOGIN_ACCOUNT_THROTTLE_RATE="3/min", AUTH_LOGIN_IP_THROTTLE_RATE="100/min")
def test_login_blocks_repeated_attempts_for_same_account(api_client):
    get_user_model().objects.create_user(email="a@example.com", password="secret123", full_name="A")
    for _ in range(3):
        response = api_client.post("/api/v1/auth/login/", {"identifier": "a@example.com", "password": "wrong"}, format="json")
        assert response.status_code != 429

    response = api_client.post("/api/v1/auth/login/", {"identifier": "a@example.com", "password": "wrong"}, format="json")
    assert response.status_code == 429

    # Tai khoan khac cung IP (vd. cung phong thi) van dang nhap duoc.
    get_user_model().objects.create_user(email="b@example.com", password="secret123", full_name="B")
    response = api_client.post("/api/v1/auth/login/", {"identifier": "b@example.com", "password": "secret123"}, format="json")
    assert response.status_code == 200


@pytest.mark.django_db
@override_settings(AUTH_LOGIN_ACCOUNT_THROTTLE_RATE="100/min", AUTH_LOGIN_IP_THROTTLE_RATE="2/min")
def test_login_ip_limit_applies_across_accounts(api_client):
    for index in range(2):
        response = api_client.post("/api/v1/auth/login/", {"identifier": f"u{index}@example.com", "password": "x"}, format="json")
        assert response.status_code != 429
    response = api_client.post("/api/v1/auth/login/", {"identifier": "u9@example.com", "password": "x"}, format="json")
    assert response.status_code == 429


@pytest.mark.django_db
@override_settings(AUTH_PASSWORD_RESET_EMAIL_THROTTLE_RATE="2/hour", AUTH_PASSWORD_RESET_IP_THROTTLE_RATE="100/hour")
def test_forgot_password_is_limited_per_email(api_client):
    for _ in range(2):
        response = api_client.post("/api/v1/auth/forgot-password/", {"email": "x@example.com"}, format="json")
        assert response.status_code == 202
    response = api_client.post("/api/v1/auth/forgot-password/", {"email": "X@example.com"}, format="json")
    assert response.status_code == 429
