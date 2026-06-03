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
    assert response.json()["detail"] == "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi."


@pytest.mark.django_db
def test_candidate_profile_response_hides_email(api_client, candidate_user):
    from apps.identity.models import Role, UserRole
    from rest_framework_simplejwt.tokens import RefreshToken

    role, _ = Role.objects.get_or_create(slug="candidate", defaults={"name": "Candidate", "is_system": True})
    UserRole.objects.get_or_create(user=candidate_user, role=role, defaults={"is_active": True})

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/profile/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == ""
    assert payload["full_name"] == candidate_user.full_name


@pytest.mark.django_db
def test_candidate_profile_cannot_be_updated(api_client, candidate_user):
    from apps.identity.models import Profile, Role, UserRole
    from rest_framework_simplejwt.tokens import RefreshToken

    role, _ = Role.objects.get_or_create(slug="candidate", defaults={"name": "Candidate", "is_system": True})
    UserRole.objects.get_or_create(user=candidate_user, role=role, defaults={"is_active": True})
    profile = Profile.objects.create(user=candidate_user, phone_number="0900000000")

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.patch(
        "/api/v1/profile/",
        {
            "full_name": "Updated Candidate",
            "phone_number": "0911111111",
        },
        format="json",
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Thông tin đăng ký của học sinh được khóa theo danh sách đã import."
    candidate_user.refresh_from_db()
    profile.refresh_from_db()
    assert candidate_user.full_name == "Candidate User"
    assert profile.phone_number == "0900000000"
