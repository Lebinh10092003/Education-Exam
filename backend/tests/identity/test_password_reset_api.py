import pytest
from django.core import mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


@pytest.mark.django_db
def test_forgot_password_returns_vietnamese_message_and_email(api_client, user):
    response = api_client.post(
        "/api/v1/auth/forgot-password/",
        {"email": user.email},
        format="json",
        HTTP_ACCEPT_LANGUAGE="vi",
    )

    assert response.status_code == 202
    assert response.json()["detail"] == "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi."
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "EduExam - Huong dan dat lai mat khau"
    assert "/reset-password?uid=" in mail.outbox[0].body


@pytest.mark.django_db
def test_forgot_password_returns_english_message_and_email(api_client, user):
    response = api_client.post(
        "/api/v1/auth/forgot-password/",
        {"email": user.email},
        format="json",
        HTTP_ACCEPT_LANGUAGE="en",
    )

    assert response.status_code == 202
    assert response.json()["detail"] == "If an account exists for that email, password reset instructions will be sent."
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "EduExam - Password reset instructions"
    assert "/reset-password?uid=" in mail.outbox[0].body


@pytest.mark.django_db
def test_reset_password_updates_credentials(api_client, user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    response = api_client.post(
        "/api/v1/auth/reset-password/",
        {
            "uid": uid,
            "token": token,
            "new_password": "brand-new-secret-123",
            "confirm_password": "brand-new-secret-123",
        },
        format="json",
        HTTP_ACCEPT_LANGUAGE="en",
    )

    assert response.status_code == 200
    assert response.json()["detail"] == "Password has been updated."
    user.refresh_from_db()
    assert user.check_password("brand-new-secret-123")
