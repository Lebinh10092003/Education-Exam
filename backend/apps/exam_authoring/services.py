import csv
from io import StringIO
import re
from datetime import datetime
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError

from apps.identity.models import Profile, Role, UserRole
from apps.identity.utils import build_student_username, ensure_unique_username
from apps.institutions.models import CandidateGroup
from apps.institutions.services import resolve_school_from_import
from apps.platform_core.audit import record_audit_event
from apps.platform_core.i18n import t
from apps.question_bank.models import Question

from .lifecycle import resolve_exam_phase
from .models import Exam, ExamAssignment, ExamItem, ExamRandomRule, ExamScheduleWindow, ExamVersion

UNSET = object()
CSV_REQUIRED_STUDENT_IMPORT_FIELDS = ("full_name", "date_of_birth", "student_class", "cccd")


def _coerce_datetime(value):
    if value in (None, "", UNSET):
        return None if value is not UNSET else UNSET
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = parse_datetime(str(value))
        if parsed is None:
            raise ValueError(f"Invalid datetime value: {value}")
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _normalize_cccd(value):
    if value is None:
        return ""
    return re.sub(r"\s+", "", str(value)).strip()


def _parse_student_import_date(value):
    raw_value = (value or "").strip()
    if not raw_value:
        raise ValueError("date_of_birth is required.")
    try:
        return datetime.strptime(raw_value, "%d/%m/%Y").date()
    except ValueError as exc:
        raise ValueError("date_of_birth must use DD/MM/YYYY format.") from exc


def _decode_csv_upload(uploaded_file):
    if not uploaded_file:
        raise ValidationError("A CSV file is required.")
    file_name = getattr(uploaded_file, "name", "") or ""
    if not file_name.lower().endswith(".csv"):
        raise ValidationError("Only CSV imports are supported.")

    uploaded_file.seek(0)
    decoded = uploaded_file.read().decode("utf-8-sig")
    reader = csv.DictReader(StringIO(decoded))
    headers = reader.fieldnames or []
    missing_headers = [header for header in CSV_REQUIRED_STUDENT_IMPORT_FIELDS if header not in headers]
    if missing_headers:
        raise ValidationError(f"Missing required columns: {', '.join(missing_headers)}")
    return list(reader)


def _get_candidate_role():
    role, _ = Role.objects.get_or_create(
        slug="candidate",
        defaults={"name": "Candidate", "is_system": True},
    )
    return role


def _resolve_import_email(*, row_email, username, existing_user=None):
    normalized_email = (row_email or "").strip().lower()
    if existing_user is not None and not normalized_email:
        return existing_user.email
    if not normalized_email:
        normalized_email = f"{username}@student.local"
    return normalized_email


def _is_email_available(*, email, current_user_id=None):
    user_model = get_user_model()
    queryset = user_model.objects.filter(email__iexact=email)
    if current_user_id is not None:
        queryset = queryset.exclude(id=current_user_id)
    return not queryset.exists()


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


def _sync_profile(*, profile, cccd, date_of_birth, student_class, phone_number, school):
    changed = False

    if profile.cccd != cccd:
        profile.cccd = cccd
        changed = True
    if profile.date_of_birth != date_of_birth:
        profile.date_of_birth = date_of_birth
        changed = True
    if profile.student_class != student_class:
        profile.student_class = student_class
        changed = True
    if (profile.phone_number or "") != phone_number:
        profile.phone_number = phone_number
        changed = True
    if profile.school != school:
        profile.school = school
        changed = True

    if changed:
        profile.save()
    return changed


@transaction.atomic
def _import_student_row(*, exam, assigned_by, row, row_number, candidate_role, schools_cache=None):
    user_model = get_user_model()
    full_name = (row.get("full_name") or "").strip()
    if not full_name:
        raise ValueError("full_name is required.")

    cccd = _normalize_cccd(row.get("cccd"))
    if not cccd:
        raise ValueError("cccd is required.")

    date_of_birth = _parse_student_import_date(row.get("date_of_birth"))
    student_class = (row.get("student_class") or "").strip()
    if not student_class:
        raise ValueError("student_class is required.")

    phone_number = (row.get("phone_number") or "").strip()
    school = resolve_school_from_import(
        school_code=row.get("school_code"),
        school_name=row.get("school") or row.get("school_name"),
        cache=schools_cache,
    )
    existing_profile = Profile.objects.select_related("user").filter(cccd=cccd).first()

    if existing_profile is not None:
        user = existing_profile.user
        email = _resolve_import_email(row_email=row.get("email"), username=user.username, existing_user=user)
        if email != user.email and not _is_email_available(email=email, current_user_id=user.id):
            raise ValueError(f"email already belongs to another user: {email}")

        changed = False
        if user.full_name != full_name:
            user.full_name = full_name
            changed = True
        if email != user.email:
            user.email = email
            changed = True
        if changed:
            user.save(update_fields=["full_name", "email", "updated_at"])

        changed = _sync_profile(
            profile=existing_profile,
            cccd=cccd,
            date_of_birth=date_of_birth,
            student_class=student_class,
            phone_number=phone_number,
            school=school,
        ) or changed
        changed = _ensure_candidate_role(user=user, role=candidate_role) or changed
        _, assignment_created = ExamAssignment.objects.get_or_create(
            exam=exam,
            user=user,
            defaults={"assigned_by": assigned_by},
        )
        return {
            "created": False,
            "updated": changed,
            "assigned": assignment_created,
            "skipped": not changed and not assignment_created,
        }

    generated_username = build_student_username(
        full_name=full_name,
        date_of_birth=date_of_birth,
        student_class=student_class,
    )
    username = ensure_unique_username(generated_username)
    email = _resolve_import_email(row_email=row.get("email"), username=username)
    if not _is_email_available(email=email):
        raise ValueError(f"email already belongs to another user: {email}")

    user = user_model.objects.create_user(
        username=username,
        email=email,
        password=username,
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
        school=school,
    )
    _ensure_candidate_role(user=user, role=candidate_role)
    ExamAssignment.objects.get_or_create(
        exam=exam,
        user=user,
        defaults={"assigned_by": assigned_by},
    )
    return {
        "created": True,
        "updated": False,
        "assigned": True,
        "skipped": False,
    }


def import_students_to_exam(*, exam, assigned_by, uploaded_file):
    rows = _decode_csv_upload(uploaded_file)
    candidate_role = _get_candidate_role()
    schools_cache = {}
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
            result = _import_student_row(
                exam=exam,
                assigned_by=assigned_by,
                row=row,
                row_number=index,
                candidate_role=candidate_role,
                schools_cache=schools_cache,
            )
        except ValueError as exc:
            summary["failed_rows"] += 1
            summary["errors"].append(
                {
                    "row_number": index,
                    "identifier": _normalize_cccd(row.get("cccd")) or (row.get("full_name") or "").strip(),
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


def _dedupe_preserve_order(values):
    seen = set()
    deduped = []
    for value in values or []:
        normalized = int(value)
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _normalize_random_rules(random_rules):
    normalized_rules = []
    for index, raw_rule in enumerate(random_rules or [], start=1):
        normalized_rules.append(
            {
                "sort_order": index,
                "difficulty": raw_rule.get("difficulty") or "",
                "question_type": raw_rule.get("question_type") or "",
                "tag_ids": _dedupe_preserve_order(raw_rule.get("tag_ids", [])),
                "count": int(raw_rule["count"]),
            }
        )
    return normalized_rules


def _validate_schedule(opens_at, closes_at):
    if opens_at and closes_at and closes_at <= opens_at:
        raise ValidationError(
            t(
                vi="Thời gian đóng phải sau thời gian mở.",
                en="closing_at must be after opening_at.",
            )
        )


def _resolve_manual_revisions(*, subject, manual_question_ids):
    question_ids = _dedupe_preserve_order(manual_question_ids)
    if not question_ids:
        return []

    questions = {
        question.id: question
        for question in Question.objects.filter(subject=subject, id__in=question_ids).select_related("current_revision")
    }
    missing_ids = [question_id for question_id in question_ids if question_id not in questions]
    if missing_ids:
        raise ValidationError(
            t(
                vi=f"Không tìm thấy câu hỏi cho môn {subject.code}: {', '.join(map(str, missing_ids))}",
                en=f"Questions not found for subject {subject.code}: {', '.join(map(str, missing_ids))}",
            )
        )

    revisions = []
    for question_id in question_ids:
        question = questions[question_id]
        if question.current_revision_id is None:
            raise ValidationError(
                t(
                    vi=f"Câu hỏi {question_id} chưa có phiên bản đang hoạt động.",
                    en=f"Question {question_id} does not have an active revision.",
                )
            )
        revisions.append(question.current_revision)
    return revisions


def _resolve_random_item_specs(*, subject, random_rules, excluded_question_ids=None):
    excluded_ids = set(excluded_question_ids or [])
    normalized_rules = _normalize_random_rules(random_rules)
    item_specs = []

    for rule in normalized_rules:
        queryset = Question.objects.filter(subject=subject, current_revision__isnull=False)
        if rule["difficulty"]:
            queryset = queryset.filter(difficulty=rule["difficulty"])
        if rule["question_type"]:
            queryset = queryset.filter(question_type=rule["question_type"])
        if rule["tag_ids"]:
            queryset = queryset.filter(tags__id__in=rule["tag_ids"])
        if excluded_ids:
            queryset = queryset.exclude(id__in=excluded_ids)

        candidates = list(queryset.select_related("current_revision").distinct().order_by("id")[: rule["count"]])
        if len(candidates) != rule["count"]:
            raise ValidationError(
                t(
                    vi=f"Không đủ câu hỏi trong ngân hàng cho luật chọn ngẫu nhiên #{rule['sort_order']}.",
                    en=f"Not enough questions available for random rule #{rule['sort_order']}."
                )
            )

        for question in candidates:
            excluded_ids.add(question.id)
            item_specs.append(
                {
                    "question_revision": question.current_revision,
                    "source": ExamItem.Source.RANDOM,
                }
            )

    return item_specs, normalized_rules


def _next_version_number(exam):
    current_max = exam.versions.aggregate(max_version=Max("version_number"))["max_version"] or 0
    return current_max + 1


def _create_exam_version(*, exam, created_by, item_specs, random_rules):
    version = ExamVersion.objects.create(
        exam=exam,
        version_number=_next_version_number(exam),
        created_by=created_by,
    )
    ExamItem.objects.bulk_create(
        [
            ExamItem(
                version=version,
                question_revision=item_spec["question_revision"],
                source=item_spec["source"],
                sort_order=index,
            )
            for index, item_spec in enumerate(item_specs, start=1)
        ]
    )
    ExamRandomRule.objects.bulk_create(
        [
            ExamRandomRule(
                version=version,
                sort_order=rule["sort_order"],
                difficulty=rule["difficulty"],
                question_type=rule["question_type"],
                tag_ids=rule["tag_ids"],
                count=rule["count"],
            )
            for rule in random_rules
        ]
    )
    exam.current_version = version
    exam.save(update_fields=["current_version"])
    return version


def _upsert_schedule_window(*, exam, opening_at=UNSET, closing_at=UNSET):
    if opening_at is UNSET and closing_at is UNSET and not hasattr(exam, "schedule_window"):
        return None

    opens_at = _coerce_datetime(opening_at)
    closes_at = _coerce_datetime(closing_at)
    if opening_at is UNSET and hasattr(exam, "schedule_window"):
        opens_at = exam.schedule_window.opens_at
    if closing_at is UNSET and hasattr(exam, "schedule_window"):
        closes_at = exam.schedule_window.closes_at

    _validate_schedule(opens_at, closes_at)
    schedule_window, _ = ExamScheduleWindow.objects.update_or_create(
        exam=exam,
        defaults={"opens_at": opens_at, "closes_at": closes_at},
    )
    return schedule_window


def _validate_assignments(*, group_ids=None, user_ids=None):
    resolved_group_ids = _dedupe_preserve_order(group_ids) if group_ids is not UNSET else UNSET
    resolved_user_ids = _dedupe_preserve_order(user_ids) if user_ids is not UNSET else UNSET

    if resolved_group_ids is not UNSET:
        found_group_ids = set(CandidateGroup.objects.filter(id__in=resolved_group_ids).values_list("id", flat=True))
        missing_group_ids = [group_id for group_id in resolved_group_ids if group_id not in found_group_ids]
        if missing_group_ids:
            raise ValidationError(
                t(
                    vi=f"Không tìm thấy nhóm: {', '.join(map(str, missing_group_ids))}",
                    en=f"Unknown group ids: {', '.join(map(str, missing_group_ids))}",
                )
            )

    if resolved_user_ids is not UNSET:
        user_model = get_user_model()
        found_user_ids = set(user_model.objects.filter(id__in=resolved_user_ids).values_list("id", flat=True))
        missing_user_ids = [user_id for user_id in resolved_user_ids if user_id not in found_user_ids]
        if missing_user_ids:
            raise ValidationError(
                t(
                    vi=f"Không tìm thấy người dùng: {', '.join(map(str, missing_user_ids))}",
                    en=f"Unknown user ids: {', '.join(map(str, missing_user_ids))}",
                )
            )

    return resolved_group_ids, resolved_user_ids


@transaction.atomic
def sync_exam_assignments(*, exam, assigned_by, group_ids=UNSET, user_ids=UNSET, request=None):
    resolved_group_ids, resolved_user_ids = _validate_assignments(group_ids=group_ids, user_ids=user_ids)
    previous_group_ids = set(
        ExamAssignment.objects.filter(exam=exam, group__isnull=False).values_list("group_id", flat=True)
    )
    previous_user_ids = set(
        ExamAssignment.objects.filter(exam=exam, user__isnull=False).values_list("user_id", flat=True)
    )

    if resolved_group_ids is not UNSET:
        ExamAssignment.objects.filter(exam=exam, group__isnull=False).exclude(group_id__in=resolved_group_ids).delete()
        existing_group_ids = set(
            ExamAssignment.objects.filter(exam=exam, group__isnull=False).values_list("group_id", flat=True)
        )
        ExamAssignment.objects.bulk_create(
            [
                ExamAssignment(exam=exam, group_id=group_id, assigned_by=assigned_by)
                for group_id in resolved_group_ids
                if group_id not in existing_group_ids
            ]
        )

    if resolved_user_ids is not UNSET:
        ExamAssignment.objects.filter(exam=exam, user__isnull=False).exclude(user_id__in=resolved_user_ids).delete()
        existing_user_ids = set(
            ExamAssignment.objects.filter(exam=exam, user__isnull=False).values_list("user_id", flat=True)
        )
        ExamAssignment.objects.bulk_create(
            [
                ExamAssignment(exam=exam, user_id=user_id, assigned_by=assigned_by)
                for user_id in resolved_user_ids
                if user_id not in existing_user_ids
            ]
        )

    current_group_ids = set(
        ExamAssignment.objects.filter(exam=exam, group__isnull=False).values_list("group_id", flat=True)
    )
    current_user_ids = set(
        ExamAssignment.objects.filter(exam=exam, user__isnull=False).values_list("user_id", flat=True)
    )
    added_group_ids = sorted(current_group_ids - previous_group_ids)
    removed_group_ids = sorted(previous_group_ids - current_group_ids)
    added_user_ids = sorted(current_user_ids - previous_user_ids)
    removed_user_ids = sorted(previous_user_ids - current_user_ids)
    if added_group_ids or removed_group_ids or added_user_ids or removed_user_ids:
        record_audit_event(
            actor=assigned_by,
            action="exam.assignments.synced",
            category="exam",
            description=f'Synchronized assignments for exam "{exam.name}".',
            metadata={
                "exam_id": exam.id,
                "added_group_ids": added_group_ids,
                "removed_group_ids": removed_group_ids,
                "added_user_ids": added_user_ids,
                "removed_user_ids": removed_user_ids,
                "group_count": len(current_group_ids),
                "user_count": len(current_user_ids),
            },
            request=request,
        )

    return exam


def _build_current_composition(exam):
    if exam.current_version_id is None:
        return [], []

    manual_question_ids = list(
        exam.current_version.items.filter(source=ExamItem.Source.MANUAL).values_list(
            "question_revision__question_id",
            flat=True,
        )
    )
    random_rules = [
        {
            "difficulty": rule.difficulty or None,
            "question_type": rule.question_type or None,
            "tag_ids": rule.tag_ids,
            "count": rule.count,
        }
        for rule in exam.current_version.random_rules.order_by("sort_order")
    ]
    return manual_question_ids, random_rules


@transaction.atomic
def create_exam(
    *,
    name,
    mode=Exam.Mode.EXAM,
    subject,
    created_by,
    description="",
    status=Exam.Status.DRAFT,
    duration_minutes=60,
    passing_score=60,
    max_attempts=1,
    shuffle_questions=False,
    show_results_immediately=False,
    enable_proctoring=False,
    opening_at=None,
    closing_at=None,
    manual_question_ids=None,
    random_rules=None,
    group_ids=None,
    user_ids=None,
    request=None,
):
    exam = Exam.objects.create(
        name=name,
        mode=mode,
        subject=subject,
        description=description or "",
        status=status,
        duration_minutes=duration_minutes,
        passing_score=passing_score,
        max_attempts=max_attempts,
        shuffle_questions=shuffle_questions,
        show_results_immediately=show_results_immediately,
        enable_proctoring=enable_proctoring,
        created_by=created_by,
        updated_by=created_by,
    )

    manual_revisions = _resolve_manual_revisions(subject=subject, manual_question_ids=manual_question_ids or [])
    random_item_specs, normalized_rules = _resolve_random_item_specs(
        subject=subject,
        random_rules=random_rules or [],
        excluded_question_ids=[revision.question_id for revision in manual_revisions],
    )
    _create_exam_version(
        exam=exam,
        created_by=created_by,
        item_specs=[
            *[
                {"question_revision": revision, "source": ExamItem.Source.MANUAL}
                for revision in manual_revisions
            ],
            *random_item_specs,
        ],
        random_rules=normalized_rules,
    )
    _upsert_schedule_window(exam=exam, opening_at=opening_at, closing_at=closing_at)
    sync_exam_assignments(
        exam=exam,
        assigned_by=created_by,
        group_ids=group_ids or [],
        user_ids=user_ids or [],
        request=request,
    )
    return exam


@transaction.atomic
def revise_exam(
    *,
    exam,
    updated_by,
    name=UNSET,
    mode=UNSET,
    subject=UNSET,
    description=UNSET,
    status=UNSET,
    duration_minutes=UNSET,
    passing_score=UNSET,
    max_attempts=UNSET,
    shuffle_questions=UNSET,
    show_results_immediately=UNSET,
    enable_proctoring=UNSET,
    opening_at=UNSET,
    closing_at=UNSET,
    manual_question_ids=UNSET,
    random_rules=UNSET,
    group_ids=UNSET,
    user_ids=UNSET,
    bonus_minutes=0,
    request=None,
):
    updated_fields = ["updated_by"]
    exam.updated_by = updated_by

    for field_name, value in (
        ("name", name),
        ("mode", mode),
        ("subject", subject),
        ("description", description),
        ("duration_minutes", duration_minutes),
        ("passing_score", passing_score),
        ("max_attempts", max_attempts),
        ("shuffle_questions", shuffle_questions),
        ("show_results_immediately", show_results_immediately),
        ("enable_proctoring", enable_proctoring),
    ):
        if value is not UNSET:
            setattr(exam, field_name, value)
            updated_fields.append(field_name)

    exam.save(update_fields=updated_fields)

    if opening_at is not UNSET or closing_at is not UNSET:
        _upsert_schedule_window(exam=exam, opening_at=opening_at, closing_at=closing_at)

    if manual_question_ids is not UNSET or random_rules is not UNSET:
        current_manual_question_ids, current_random_rules = _build_current_composition(exam)
        effective_manual_ids = current_manual_question_ids if manual_question_ids is UNSET else manual_question_ids
        effective_random_rules = current_random_rules if random_rules is UNSET else random_rules
        manual_revisions = _resolve_manual_revisions(subject=exam.subject, manual_question_ids=effective_manual_ids)
        random_item_specs, normalized_rules = _resolve_random_item_specs(
            subject=exam.subject,
            random_rules=effective_random_rules,
            excluded_question_ids=[revision.question_id for revision in manual_revisions],
        )
        _create_exam_version(
            exam=exam,
            created_by=updated_by,
            item_specs=[
                *[
                    {"question_revision": revision, "source": ExamItem.Source.MANUAL}
                    for revision in manual_revisions
                ],
                *random_item_specs,
            ],
            random_rules=normalized_rules,
        )

    if group_ids is not UNSET or user_ids is not UNSET:
        sync_exam_assignments(
            exam=exam,
            assigned_by=updated_by,
            group_ids=group_ids,
            user_ids=user_ids,
            request=request,
        )

    if status is not UNSET and status != exam.status:
        transition_exam_status(
            exam=exam,
            next_status=status,
            actor=updated_by,
            bonus_minutes=bonus_minutes,
            request=request,
        )

    return exam


def _iter_active_sessions(exam):
    from apps.exam_delivery.models import ExamSession

    return list(
        exam.sessions.select_related("candidate", "exam", "exam_version")
        .prefetch_related("questions__answer", "questions__question_revision__question", "questions__question_revision__answer_key")
        .filter(status=ExamSession.Status.IN_PROGRESS)
        .order_by("id")
    )


def _freeze_exam_sessions(*, exam, now):
    touched_sessions = []
    for session in _iter_active_sessions(exam):
        if session.paused_at is not None and session.remaining_seconds_at_pause is not None:
            continue
        remaining_seconds = max(0, int((session.expires_at - now).total_seconds()))
        session.paused_at = now
        session.remaining_seconds_at_pause = remaining_seconds
        session.save(update_fields=["paused_at", "remaining_seconds_at_pause", "updated_at"])
        touched_sessions.append(session)
    return touched_sessions


def _resume_exam_sessions(*, exam, now, bonus_minutes=0):
    bonus_seconds = max(int(bonus_minutes or 0), 0) * 60
    touched_sessions = []
    for session in _iter_active_sessions(exam):
        if session.paused_at is None or session.remaining_seconds_at_pause is None:
            continue
        session.expires_at = now + timedelta(seconds=session.remaining_seconds_at_pause + bonus_seconds)
        session.paused_at = None
        session.remaining_seconds_at_pause = None
        session.save(update_fields=["expires_at", "paused_at", "remaining_seconds_at_pause", "updated_at"])
        touched_sessions.append(session)
    return touched_sessions


def _broadcast_exam_phase_updates(*, sessions):
    from apps.proctoring.services import broadcast_session_phase_update

    for session in sessions:
        broadcast_session_phase_update(session=session)


def _cleanup_exam_runtime_state(*, exam):
    from apps.proctoring.runtime import mark_live_request, release_live_slot

    for session in exam.sessions.only("id"):
        mark_live_request(session_id=session.id, enabled=False, payload={"exam_id": exam.id})
        release_live_slot(session_id=session.id, exam_id=exam.id)


def _force_close_exam_sessions(*, exam, actor):
    from apps.exam_delivery.models import Submission
    from apps.exam_delivery.services import submit_session

    touched_sessions = []
    for session in _iter_active_sessions(exam):
        submit_session(
            session=session,
            submitted_by=actor,
            source=Submission.Source.FORCED_CLOSE,
            force=True,
        )
        touched_sessions.append(session)
    return touched_sessions


def _auto_publish_closed_results(*, exam, actor, request=None):
    from apps.grading.models import Result
    from apps.grading.services import publish_result

    if not exam.show_results_immediately:
        return

    for result in (
        Result.objects.select_related("session", "session__exam")
        .filter(
            session__exam=exam,
            workflow_status=Result.WorkflowStatus.FINALIZED,
            publish_state=Result.PublishState.DRAFT,
        )
        .order_by("id")
    ):
        publish_result(result=result, published_by=actor, request=request)


def transition_exam_status(*, exam, next_status, actor, bonus_minutes=0, request=None):
    allowed_transitions = {
        Exam.Status.DRAFT: {Exam.Status.SCHEDULED, Exam.Status.OPEN},
        Exam.Status.SCHEDULED: {Exam.Status.DRAFT, Exam.Status.OPEN, Exam.Status.CLOSED},
        Exam.Status.OPEN: {Exam.Status.SCHEDULED, Exam.Status.PAUSED, Exam.Status.CLOSED},
        Exam.Status.PAUSED: {Exam.Status.SCHEDULED, Exam.Status.OPEN, Exam.Status.CLOSED},
        Exam.Status.CLOSED: {Exam.Status.SCHEDULED, Exam.Status.DRAFT, Exam.Status.OPEN},
        Exam.Status.ARCHIVED: set(),
    }
    next_status = str(next_status)
    current_status = exam.status

    if next_status == current_status:
        if next_status == Exam.Status.OPEN and bonus_minutes and resolve_exam_phase(exam) == "paused":
            now = timezone.now()
            exam.status = Exam.Status.OPEN
            exam.updated_by = actor
            exam.save(update_fields=["status", "updated_by", "updated_at"])
            resumed_sessions = _resume_exam_sessions(exam=exam, now=now, bonus_minutes=bonus_minutes)
            _broadcast_exam_phase_updates(sessions=resumed_sessions)
            return exam
        return exam

    if next_status not in allowed_transitions.get(current_status, set()):
        raise ValidationError(
            t(
                vi=f"Khong the chuyen trang thai tu {current_status} sang {next_status}.",
                en=f"Cannot transition exam from {current_status} to {next_status}.",
            )
        )

    now = timezone.now()
    exam.status = next_status
    exam.updated_by = actor
    exam.save(update_fields=["status", "updated_by", "updated_at"])

    transitioned_sessions = []
    if current_status == Exam.Status.OPEN and next_status in {Exam.Status.PAUSED, Exam.Status.SCHEDULED, Exam.Status.DRAFT}:
        transitioned_sessions = _freeze_exam_sessions(exam=exam, now=now)
    elif current_status in {Exam.Status.PAUSED, Exam.Status.SCHEDULED, Exam.Status.DRAFT} and next_status == Exam.Status.OPEN:
        transitioned_sessions = _resume_exam_sessions(exam=exam, now=now, bonus_minutes=bonus_minutes)
    elif next_status == Exam.Status.CLOSED:
        transitioned_sessions = _force_close_exam_sessions(exam=exam, actor=actor)
        _cleanup_exam_runtime_state(exam=exam)
        _auto_publish_closed_results(exam=exam, actor=actor, request=request)
    if transitioned_sessions:
        _broadcast_exam_phase_updates(sessions=transitioned_sessions)

    record_audit_event(
        actor=actor,
        action="exam.status.transitioned",
        category="exam",
        description=f'Transitioned exam "{exam.name}" from {current_status} to {next_status}.',
        metadata={
            "exam_id": exam.id,
            "from_status": current_status,
            "to_status": next_status,
            "bonus_minutes": max(int(bonus_minutes or 0), 0),
        },
        request=request,
    )
    return exam


def sync_exam_lifecycle(*, now=None, actor=None):
    current_time = now or timezone.now()
    transitioned_exam_ids = []
    transition_actor = actor or Exam.objects.order_by("id").values_list("updated_by_id", flat=True).first()
    actor_user = None
    if transition_actor:
        actor_user = get_user_model().objects.filter(pk=transition_actor).first()

    candidates = (
        Exam.objects.select_related("schedule_window")
        .exclude(status__in=[Exam.Status.DRAFT, Exam.Status.CLOSED, Exam.Status.ARCHIVED])
        .filter(schedule_window__isnull=False)
    )
    for exam in candidates:
        schedule_window = getattr(exam, "schedule_window", None)
        opens_at = getattr(schedule_window, "opens_at", None)
        closes_at = getattr(schedule_window, "closes_at", None)
        if closes_at and closes_at <= current_time and exam.status in {
            Exam.Status.SCHEDULED,
            Exam.Status.OPEN,
            Exam.Status.PAUSED,
        }:
            transition_exam_status(exam=exam, next_status=Exam.Status.CLOSED, actor=actor_user or exam.updated_by)
            transitioned_exam_ids.append(exam.id)
            continue
        if (
            opens_at
            and opens_at <= current_time
            and exam.status == Exam.Status.SCHEDULED
            and (closes_at is None or closes_at > current_time)
        ):
            transition_exam_status(exam=exam, next_status=Exam.Status.OPEN, actor=actor_user or exam.updated_by)
            transitioned_exam_ids.append(exam.id)
    return transitioned_exam_ids


@transaction.atomic
def clone_exam(*, exam, created_by):
    cloned_exam = Exam.objects.create(
        name=f"{exam.name} (Copy)",
        mode=exam.mode,
        subject=exam.subject,
        description=exam.description,
        status=Exam.Status.DRAFT,
        duration_minutes=exam.duration_minutes,
        passing_score=exam.passing_score,
        max_attempts=exam.max_attempts,
        shuffle_questions=exam.shuffle_questions,
        show_results_immediately=exam.show_results_immediately,
        enable_proctoring=exam.enable_proctoring,
        created_by=created_by,
        updated_by=created_by,
    )

    source_version = exam.current_version
    if source_version is not None:
        item_specs = [
            {
                "question_revision": item.question_revision,
                "source": item.source,
            }
            for item in source_version.items.select_related("question_revision").order_by("sort_order")
        ]
        random_rules = [
            {
                "sort_order": rule.sort_order,
                "difficulty": rule.difficulty,
                "question_type": rule.question_type,
                "tag_ids": rule.tag_ids,
                "count": rule.count,
            }
            for rule in source_version.random_rules.order_by("sort_order")
        ]
        _create_exam_version(
            exam=cloned_exam,
            created_by=created_by,
            item_specs=item_specs,
            random_rules=random_rules,
        )
    else:
        _create_exam_version(exam=cloned_exam, created_by=created_by, item_specs=[], random_rules=[])

    if hasattr(exam, "schedule_window"):
        _upsert_schedule_window(
            exam=cloned_exam,
            opening_at=exam.schedule_window.opens_at,
            closing_at=exam.schedule_window.closes_at,
        )

    sync_exam_assignments(
        exam=cloned_exam,
        assigned_by=created_by,
        group_ids=list(exam.assignments.filter(group__isnull=False).values_list("group_id", flat=True)),
        user_ids=list(exam.assignments.filter(user__isnull=False).values_list("user_id", flat=True)),
    )
    return cloned_exam


def build_exam_assignment_summary(exam):
    group_assignments = list(
        exam.assignments.filter(group__isnull=False)
        .select_related("group")
        .annotate(
            member_count=Count(
                "group__memberships",
                filter=Q(group__memberships__is_active=True),
                distinct=True,
            )
        )
    )
    user_assignments = list(exam.assignments.filter(user__isnull=False).select_related("user"))
    total_candidates = sum(assignment.member_count for assignment in group_assignments) + len(user_assignments)

    return {
        "group_count": len(group_assignments),
        "user_count": len(user_assignments),
        "total_candidates": total_candidates,
        "assigned_group_ids": [assignment.group_id for assignment in group_assignments],
        "assigned_user_ids": [assignment.user_id for assignment in user_assignments],
        "assigned_groups": [
            {
                "id": assignment.group_id,
                "name": assignment.group.name,
                "member_count": assignment.member_count,
            }
            for assignment in group_assignments
        ],
    }
