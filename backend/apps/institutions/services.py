import csv
import re
from datetime import datetime
from io import StringIO

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.identity.models import Profile, Role, UserRole
from apps.identity.utils import (
    build_email_username,
    build_student_username,
    ensure_unique_username,
    normalize_username_segment,
)

from .models import GroupMembership, School

CSV_REQUIRED_GROUP_IMPORT_FIELDS = ("full_name",)


def _normalize_cccd(value):
    if value is None:
        return ""
    return re.sub(r"\s+", "", str(value)).strip()


def _parse_optional_date(value):
    raw_value = (value or "").strip()
    if not raw_value:
        return None
    try:
        return datetime.strptime(raw_value, "%d/%m/%Y").date()
    except ValueError as exc:
        raise ValueError("date_of_birth must use DD/MM/YYYY format.") from exc


def _decode_csv_upload(uploaded_file):
    if not uploaded_file:
        raise ValueError("A CSV file is required.")

    file_name = getattr(uploaded_file, "name", "") or ""
    if not file_name.lower().endswith(".csv"):
        raise ValueError("Only CSV imports are supported.")

    uploaded_file.seek(0)
    decoded = uploaded_file.read().decode("utf-8-sig")
    reader = csv.DictReader(StringIO(decoded))
    headers = reader.fieldnames or []
    missing_headers = [header for header in CSV_REQUIRED_GROUP_IMPORT_FIELDS if header not in headers]
    if missing_headers:
        raise ValueError(f"Missing required columns: {', '.join(missing_headers)}")
    return list(reader)


def _get_candidate_role():
    role, _ = Role.objects.get_or_create(
        slug="candidate",
        defaults={"name": "Candidate", "is_system": True},
    )
    return role


def _resolve_school(school_code):
    normalized_code = (school_code or "").strip()
    if normalized_code:
        school = School.objects.filter(code__iexact=normalized_code).first()
        if school is None:
            raise ValueError(f"Unknown school_code: {normalized_code}")
        return school
    return None


def _resolve_school_from_import(*, school_code, school_name):
    school = _resolve_school(school_code)
    if school is not None:
        return school

    normalized_name = (school_name or "").strip()
    if normalized_name:
        school = School.objects.filter(name__iexact=normalized_name).first()
        if school is None:
            raise ValueError(f"Unknown school: {normalized_name}")
        return school
    return None


def _resolve_existing_user(*, email, cccd, username):
    user_model = get_user_model()
    profile = None
    if cccd:
        profile = Profile.objects.select_related("user").filter(cccd=cccd).first()
        if profile is not None:
            return profile.user, profile
    if username:
        user = user_model.objects.filter(username__iexact=username).first()
        if user is not None:
            return user, Profile.objects.filter(user=user).first()
    if email:
        user = user_model.objects.filter(email__iexact=email).first()
        if user is not None:
            return user, Profile.objects.filter(user=user).first()
    return None, None


def _is_email_available(*, email, current_user_id=None):
    user_model = get_user_model()
    queryset = user_model.objects.filter(email__iexact=email)
    if current_user_id is not None:
        queryset = queryset.exclude(id=current_user_id)
    return not queryset.exists()


def _resolve_username(*, full_name, email, date_of_birth, student_class, username="", exclude_user_id=None):
    if username:
        base_username = normalize_username_segment(username) or username.strip()
    elif email:
        base_username = build_email_username(email)
    elif date_of_birth or student_class:
        base_username = build_student_username(
            full_name=full_name,
            date_of_birth=date_of_birth,
            student_class=student_class,
        )
    else:
        base_username = normalize_username_segment(full_name) or "candidate"
    return ensure_unique_username(base_username, exclude_user_id=exclude_user_id)


def _ensure_candidate_role(*, user, role):
    user_role, created = UserRole.objects.get_or_create(
        user=user,
        role=role,
        defaults={"is_active": True},
    )
    if not created and not user_role.is_active:
        user_role.is_active = True
        user_role.save(update_fields=["is_active", "updated_at"])
        return True
    return created


def _sync_profile(
    *,
    profile,
    cccd,
    date_of_birth,
    student_class,
    phone_number,
    school,
    ward="",
    national_exam_subject="",
    exam_block="",
    candidate_number="",
    visible_password=None,
):
    changed = False

    if cccd and profile.cccd != cccd:
        profile.cccd = cccd
        changed = True
    if profile.date_of_birth != date_of_birth:
        profile.date_of_birth = date_of_birth
        changed = True
    if (profile.student_class or "") != student_class:
        profile.student_class = student_class
        changed = True
    if (profile.phone_number or "") != phone_number:
        profile.phone_number = phone_number
        changed = True
    if profile.school != school:
        profile.school = school
        changed = True
    if (profile.ward or "") != ward:
        profile.ward = ward
        changed = True
    if (profile.national_exam_subject or "") != national_exam_subject:
        profile.national_exam_subject = national_exam_subject
        changed = True
    if (profile.exam_block or "") != exam_block:
        profile.exam_block = exam_block
        changed = True
    if (profile.candidate_number or "") != candidate_number:
        profile.candidate_number = candidate_number
        changed = True
    if visible_password is not None and (profile.visible_password or "") != visible_password:
        profile.visible_password = visible_password
        changed = True

    if changed:
        profile.save()
    return changed


@transaction.atomic
def _import_group_member_row(*, group, row, candidate_role):
    user_model = get_user_model()
    full_name = (row.get("full_name") or "").strip()
    if not full_name:
        raise ValueError("full_name is required.")

    email = (row.get("email") or "").strip().lower()
    username = (row.get("username") or "").strip()
    cccd = _normalize_cccd(row.get("cccd"))
    phone_number = (row.get("phone_number") or "").strip()
    student_class = (row.get("student_class") or "").strip()
    ward = (row.get("ward") or row.get("xa_phuong") or row.get("xa/phuong") or "").strip()
    national_exam_subject = (row.get("national_exam_subject") or row.get("mon_thi_quoc_gia") or "").strip()
    exam_block = (row.get("exam_block") or row.get("khoi_thi") or student_class).strip()
    candidate_number = (
        row.get("candidate_number")
        or row.get("sbd")
        or row.get("SBD")
        or ""
    ).strip()
    raw_password = (row.get("password") or row.get("mat_khau") or "").strip()
    date_of_birth = _parse_optional_date(row.get("date_of_birth"))
    explicit_school = _resolve_school_from_import(
        school_code=row.get("school_code"),
        school_name=row.get("school"),
    )

    user, profile = _resolve_existing_user(email=email, cccd=cccd, username=username)

    if user is not None:
        resolved_school = explicit_school if explicit_school is not None else getattr(profile, "school", None)
        changed = False
        if username and username != user.username:
            user.username = _resolve_username(
                full_name=full_name,
                email=email,
                date_of_birth=date_of_birth,
                student_class=student_class,
                username=username,
                exclude_user_id=user.id,
            )
            changed = True
        if full_name != user.full_name:
            user.full_name = full_name
            changed = True
        if email and email != user.email:
            if not _is_email_available(email=email, current_user_id=user.id):
                raise ValueError(f"email already belongs to another user: {email}")
            user.email = email
            changed = True
        if raw_password:
            user.set_password(raw_password)
            changed = True
        if changed:
            user.save()

        profile = profile or Profile.objects.get_or_create(user=user)[0]
        changed = _sync_profile(
            profile=profile,
            cccd=cccd,
            date_of_birth=date_of_birth,
            student_class=student_class,
            phone_number=phone_number,
            school=resolved_school,
            ward=ward,
            national_exam_subject=national_exam_subject,
            exam_block=exam_block,
            candidate_number=candidate_number,
            visible_password=raw_password or None,
        ) or changed
        changed = _ensure_candidate_role(user=user, role=candidate_role) or changed

        membership, created = GroupMembership.objects.get_or_create(
            group=group,
            user=user,
            defaults={"is_active": True},
        )
        membership_changed = False
        if not created and not membership.is_active:
            membership.is_active = True
            membership.save(update_fields=["is_active", "updated_at"])
            membership_changed = True

        return {
            "created": False,
            "updated": changed,
            "assigned": created or membership_changed,
            "skipped": not changed and not created and not membership_changed,
        }

    username = _resolve_username(
        full_name=full_name,
        email=email,
        date_of_birth=date_of_birth,
        student_class=student_class,
        username=username,
    )
    resolved_email = email or f"{username}@student.local"
    if not _is_email_available(email=resolved_email):
        raise ValueError(f"email already belongs to another user: {resolved_email}")
    resolved_password = raw_password or username

    user = user_model.objects.create_user(
        username=username,
        email=resolved_email,
        password=resolved_password,
        full_name=full_name,
        status=user_model.Status.ACTIVE,
    )
    profile, _ = Profile.objects.get_or_create(user=user)
    _sync_profile(
        profile=profile,
        cccd=cccd,
        date_of_birth=date_of_birth,
        student_class=student_class,
        phone_number=phone_number,
        school=explicit_school,
        ward=ward,
        national_exam_subject=national_exam_subject,
        exam_block=exam_block,
        candidate_number=candidate_number,
        visible_password=resolved_password,
    )
    _ensure_candidate_role(user=user, role=candidate_role)
    GroupMembership.objects.get_or_create(group=group, user=user, defaults={"is_active": True})
    return {
        "created": True,
        "updated": False,
        "assigned": True,
        "skipped": False,
    }


def import_memberships_to_group(*, group, uploaded_file):
    rows = _decode_csv_upload(uploaded_file)
    candidate_role = _get_candidate_role()
    summary = {
        "total_rows": len(rows),
        "created_users": 0,
        "updated_users": 0,
        "assigned_users": 0,
        "skipped_rows": 0,
        "failed_rows": 0,
        "errors": [],
    }

    for index, row in enumerate(rows, start=2):
        try:
            result = _import_group_member_row(
                group=group,
                row=row,
                candidate_role=candidate_role,
            )
        except ValueError as exc:
            summary["failed_rows"] += 1
            summary["errors"].append(
                {
                    "row_number": index,
                    "identifier": _normalize_cccd(row.get("cccd")) or (row.get("email") or "").strip() or (row.get("full_name") or "").strip(),
                    "message": str(exc),
                }
            )
            continue

        if result["created"]:
            summary["created_users"] += 1
        if result["updated"]:
            summary["updated_users"] += 1
        if result["assigned"]:
            summary["assigned_users"] += 1
        if result["skipped"]:
            summary["skipped_rows"] += 1

    return summary
