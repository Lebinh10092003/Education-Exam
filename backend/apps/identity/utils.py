import re
import unicodedata

from django.contrib.auth import get_user_model


_NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9]+")
_MULTI_DOT_PATTERN = re.compile(r"\.+")
STUDENT_SELF_SERVICE_ROLE_SLUGS = {"candidate"}
STAFF_ROLE_SLUGS = {"administrator", "examiner", "proctor"}


def normalize_username_segment(value: str) -> str:
    if not value:
        return ""

    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_value.lower().strip()
    dotted = _NON_ALNUM_PATTERN.sub(".", lowered)
    collapsed = _MULTI_DOT_PATTERN.sub(".", dotted)
    return collapsed.strip(".")


def build_email_username(email: str) -> str:
    local_part = (email or "").split("@", 1)[0]
    return normalize_username_segment(local_part) or "user"


def build_student_username(*, full_name: str, date_of_birth, student_class: str) -> str:
    parts = [
        normalize_username_segment(full_name),
        date_of_birth.strftime("%d%m%Y") if date_of_birth else "",
        normalize_username_segment(student_class),
    ]
    base = ".".join(part for part in parts if part)
    return base or "student"


def ensure_unique_username(base: str, *, exclude_user_id: int | None = None) -> str:
    user_model = get_user_model()
    candidate = base or "user"

    # Fetch all usernames starting with candidate prefix in one query
    queryset = user_model.objects.filter(username__istartswith=candidate)
    if exclude_user_id is not None:
        queryset = queryset.exclude(id=exclude_user_id)
    existing_usernames = {u.lower() for u in queryset.values_list("username", flat=True)}

    suffix = 0
    while True:
        lookup_value = candidate if suffix == 0 else f"{candidate}.{suffix}"
        if lookup_value.lower() not in existing_usernames:
            return lookup_value
        suffix += 1


def is_student_self_service_locked(user) -> bool:
    active_role_slugs = set(
        user.user_roles.filter(is_active=True).values_list("role__slug", flat=True)
    )
    return bool(active_role_slugs & STUDENT_SELF_SERVICE_ROLE_SLUGS) and not bool(
        active_role_slugs & STAFF_ROLE_SLUGS
    )
