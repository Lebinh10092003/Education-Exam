from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import ValidationError

from apps.platform_core.i18n import get_current_locale, t


def build_password_reset_link(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"


def send_password_reset_email(user) -> None:
    locale = get_current_locale()
    context = {
        "user": user,
        "reset_link": build_password_reset_link(user),
    }
    subject = render_to_string(
        f"emails/password_reset_subject_{locale}.txt",
        context,
    ).strip()
    body = render_to_string(
        f"emails/password_reset_body_{locale}.txt",
        context,
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def request_password_reset(email: str) -> None:
    user_model = get_user_model()
    user = user_model.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return
    send_password_reset_email(user)


def reset_password_with_token(*, uid: str, token: str, new_password: str) -> None:
    user_model = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = user_model.objects.get(pk=user_id, is_active=True)
    except (TypeError, ValueError, OverflowError, user_model.DoesNotExist):
        raise ValidationError(
            {"token": t(vi="Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", en="Password reset link is invalid or has expired.")}
        )

    if not default_token_generator.check_token(user, token):
        raise ValidationError(
            {"token": t(vi="Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", en="Password reset link is invalid or has expired.")}
        )

    validate_password(new_password, user)
    user.set_password(new_password)
    user.save(update_fields=["password"])
