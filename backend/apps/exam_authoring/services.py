from datetime import datetime

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.institutions.models import CandidateGroup
from apps.question_bank.models import Question

from .models import Exam, ExamAssignment, ExamItem, ExamRandomRule, ExamScheduleWindow, ExamVersion

UNSET = object()


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
        raise ValueError("closing_at must be after opening_at.")


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
        raise ValueError(f"Questions not found for subject {subject.code}: {', '.join(map(str, missing_ids))}")

    revisions = []
    for question_id in question_ids:
        question = questions[question_id]
        if question.current_revision_id is None:
            raise ValueError(f"Question {question_id} does not have an active revision.")
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
            raise ValueError(f"Not enough questions available for random rule #{rule['sort_order']}.")

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
            raise ValueError(f"Unknown group ids: {', '.join(map(str, missing_group_ids))}")

    if resolved_user_ids is not UNSET:
        user_model = get_user_model()
        found_user_ids = set(user_model.objects.filter(id__in=resolved_user_ids).values_list("id", flat=True))
        missing_user_ids = [user_id for user_id in resolved_user_ids if user_id not in found_user_ids]
        if missing_user_ids:
            raise ValueError(f"Unknown user ids: {', '.join(map(str, missing_user_ids))}")

    return resolved_group_ids, resolved_user_ids


@transaction.atomic
def sync_exam_assignments(*, exam, assigned_by, group_ids=UNSET, user_ids=UNSET):
    resolved_group_ids, resolved_user_ids = _validate_assignments(group_ids=group_ids, user_ids=user_ids)

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
):
    exam = Exam.objects.create(
        name=name,
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
    )
    return exam


@transaction.atomic
def revise_exam(
    *,
    exam,
    updated_by,
    name=UNSET,
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
):
    updated_fields = ["updated_by"]
    exam.updated_by = updated_by

    for field_name, value in (
        ("name", name),
        ("subject", subject),
        ("description", description),
        ("status", status),
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
        )

    return exam


@transaction.atomic
def clone_exam(*, exam, created_by):
    cloned_exam = Exam.objects.create(
        name=f"{exam.name} (Copy)",
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
        .select_related("group", "group__school")
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
