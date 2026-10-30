from django.conf import settings
from django.core.checks import Warning, register

DEV_EMAIL_BACKENDS = {
    "django.core.mail.backends.console.EmailBackend",
    "django.core.mail.backends.dummy.EmailBackend",
    "django.core.mail.backends.filebased.EmailBackend",
}


@register("eduexam_ops")
def check_production_email(app_configs, **kwargs):
    if settings.DEBUG:
        return []
    messages = []
    if settings.EMAIL_BACKEND in DEV_EMAIL_BACKENDS:
        messages.append(
            Warning(
                "EMAIL_BACKEND dang la backend thu nghiem: email quen mat khau se khong duoc gui.",
                hint="Dat EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend va EMAIL_HOST/PORT/USER/PASSWORD.",
                id="eduexam.W001",
            )
        )
    elif settings.EMAIL_BACKEND.endswith("smtp.EmailBackend") and settings.EMAIL_HOST in {"", "localhost", "127.0.0.1"}:
        messages.append(
            Warning(
                "SMTP dang tro toi localhost; trong container thuong khong co may chu mail.",
                hint="Dat EMAIL_HOST la may chu SMTP that (vd. smtp.gmail.com).",
                id="eduexam.W002",
            )
        )
    return messages
