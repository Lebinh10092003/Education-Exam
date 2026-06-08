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


def import_users_from_csv(*, uploaded_file, requested_by):
    import csv
    from io import StringIO
    from django.db import transaction
    from apps.identity.models import Profile, Role, User, UserRole
    from apps.institutions.models import School
    from apps.identity.utils import ensure_unique_username, normalize_username_segment

    if not uploaded_file:
        raise ValidationError(t(vi="Yêu cầu tệp CSV.", en="A CSV file is required."))

    file_name = getattr(uploaded_file, "name", "") or ""
    if not file_name.lower().endswith(".csv"):
        raise ValidationError(t(vi="Chỉ hỗ trợ nhập tệp CSV.", en="Only CSV imports are supported."))

    uploaded_file.seek(0)
    try:
        decoded = uploaded_file.read().decode("utf-8-sig")
    except Exception as exc:
        raise ValidationError(t(vi=f"Lỗi giải mã CSV: {str(exc)}", en=f"Error decoding CSV: {str(exc)}"))

    reader = csv.DictReader(StringIO(decoded))
    headers = reader.fieldnames or []

    required_fields = ["full_name", "email"]
    missing_headers = [field for field in required_fields if field not in headers]
    if missing_headers:
        raise ValidationError(
            t(
                vi=f"Thiếu các cột bắt buộc: {', '.join(missing_headers)}",
                en=f"Missing required columns: {', '.join(missing_headers)}"
            )
        )

    summary = {
        "total_rows": 0,
        "created_users": 0,
        "updated_users": 0,
        "failed_rows": 0,
        "errors": [],
    }

    rows = list(reader)
    summary["total_rows"] = len(rows)

    def parse_bool(val, default=False):
        if val is None or str(val).strip() == "":
            return default
        return str(val).strip().lower() in ("true", "1", "yes")

    schools_cache = {}
    roles_cache = {}

    for index, row in enumerate(rows, start=2):
        email = (row.get("email") or "").strip().lower()
        full_name = (row.get("full_name") or "").strip()
        password = row.get("password")
        status_val = (row.get("status") or "").strip().lower()
        if not status_val:
            status_val = User.Status.ACTIVE
        is_active = parse_bool(row.get("is_active"), default=True)
        is_staff = parse_bool(row.get("is_staff"), default=False)
        phone_number = (row.get("phone_number") or "").strip()
        school_code = (row.get("school_code") or "").strip()
        role_slugs = (row.get("role_slugs") or "").strip()
        if not role_slugs:
            role_slugs = "candidate"

        try:
            if not email:
                raise ValueError("email is required.")
            if not full_name:
                raise ValueError("full_name is required.")

            if status_val not in (User.Status.ACTIVE, User.Status.PENDING, User.Status.LOCKED):
                raise ValueError(f"Invalid status: '{status_val}'. Must be active, pending, or locked.")

            school = None
            if school_code:
                school_code_lower = school_code.lower()
                if school_code_lower not in schools_cache:
                    s = School.objects.filter(code__iexact=school_code).first()
                    if not s:
                        raise ValueError(f"Unknown school_code: '{school_code}'")
                    schools_cache[school_code_lower] = s
                school = schools_cache[school_code_lower]

            roles = []
            if role_slugs:
                for slug in role_slugs.split("|"):
                    slug = slug.strip()
                    if slug:
                        slug_lower = slug.lower()
                        if slug_lower not in roles_cache:
                            r = Role.objects.filter(slug=slug).first()
                            if not r:
                                raise ValueError(f"Unknown role slug: '{slug}'")
                            roles_cache[slug_lower] = r
                        roles.append(roles_cache[slug_lower])

            with transaction.atomic():
                user = User.objects.filter(email=email).first()
                created = False
                updated = False

                if user:
                    if user.full_name != full_name:
                        user.full_name = full_name
                        updated = True
                    if user.status != status_val:
                        user.status = status_val
                        updated = True
                    if user.is_staff != is_staff:
                        user.is_staff = is_staff
                        updated = True
                    if user.is_active != is_active:
                        user.is_active = is_active
                        updated = True
                    if password and password.strip():
                        user.set_password(password)
                        updated = True
                    if updated:
                        user.save()

                    profile, _ = Profile.objects.get_or_create(user=user)
                    profile_updated = False
                    if profile.phone_number != phone_number:
                        profile.phone_number = phone_number
                        profile_updated = True
                    if profile.school != school:
                        profile.school = school
                        profile_updated = True
                    if profile_updated:
                        profile.save()
                        updated = True

                    if role_slugs:
                        current_role_ids = set(user.user_roles.filter(is_active=True).values_list("role_id", flat=True))
                        target_role_ids = {r.id for r in roles}
                        if current_role_ids != target_role_ids:
                            user.user_roles.all().delete()
                            for r in roles:
                                user.user_roles.create(role=r, is_active=True)
                            updated = True
                else:
                    base_username = normalize_username_segment(full_name) or "user"
                    username = ensure_unique_username(base_username)
                    user = User.objects.create_user(
                        email=email,
                        username=username,
                        password=password or username,
                        full_name=full_name,
                        status=status_val,
                        is_staff=is_staff,
                        is_active=is_active,
                    )
                    profile, _ = Profile.objects.get_or_create(user=user)
                    profile.phone_number = phone_number
                    profile.school = school
                    profile.save()

                    for r in roles:
                        user.user_roles.create(role=r, is_active=True)
                    created = True

                if created:
                    summary["created_users"] += 1
                elif updated:
                    summary["updated_users"] += 1

        except Exception as exc:
            summary["failed_rows"] += 1
            summary["errors"].append({
                "row_number": index,
                "identifier": email or full_name or f"Row {index}",
                "message": str(exc),
            })

    return summary
