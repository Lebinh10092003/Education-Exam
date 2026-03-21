import pytest


@pytest.mark.django_db
def test_profile_can_be_updated(api_client, admin_token, admin_user):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.patch(
        "/api/v1/profile/",
        {
            "full_name": "Updated Admin",
            "phone_number": "+84123456789",
        },
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["full_name"] == "Updated Admin"
    assert payload["phone_number"] == "+84123456789"


@pytest.mark.django_db
def test_change_password_updates_credentials(api_client, admin_token, admin_user):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/profile/change-password/",
        {
            "current_password": "secret123",
            "new_password": "new-secret-456",
        },
        format="json",
    )

    assert response.status_code == 200
    admin_user.refresh_from_db()
    assert admin_user.check_password("new-secret-456")


@pytest.mark.django_db
def test_forgot_password_request_is_public(api_client, user):
    response = api_client.post(
        "/api/v1/auth/forgot-password/",
        {
            "email": user.email,
        },
        format="json",
    )

    assert response.status_code == 202
    assert "If an account exists" in response.json()["detail"]
