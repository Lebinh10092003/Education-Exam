import random
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.exam_delivery.access import get_accessible_subject_queryset
from apps.platform_core.i18n import t
from apps.question_bank.models import Question

from .models import PracticeAutosaveSnapshot, PracticeSession, PracticeSessionQuestion

UNSET = object()
OBJECTIVE_TYPES = [Question.Type.MULTIPLE_CHOICE, Question.Type.TRUE_FALSE]
PRACTICE_TARGET_QUESTION_COUNT = 30


def _expire_if_needed(session, *, now):
    if session.status == PracticeSession.Status.IN_PROGRESS and session.expires_at <= now:
        session.status = PracticeSession.Status.EXPIRED
        session.save(update_fields=["status", "updated_at"])
        return True
    return False


def _assert_session_is_active(session):
    now = timezone.now()
    if _expire_if_needed(session, now=now):
        raise ValidationError(
            t(vi="Phiên luyện tập này đã hết hạn.", en="This practice session has expired.")
        )
    if session.status != PracticeSession.Status.IN_PROGRESS:
        raise ValidationError(
            t(vi="Phiên luyện tập này hiện không nhận câu trả lời.", en="This practice session is not accepting answers.")
        )
    return now


def _eligible_objective_question_ids(*, subject):
    return list(
        Question.objects.filter(
            subject=subject,
            question_type__in=OBJECTIVE_TYPES,
            current_revision__isnull=False,
        ).values_list("id", flat=True)
    )


def _derive_duration_minutes(question_count):
    if question_count <= 0:
        raise ValidationError(
            t(vi="Phải có ít nhất một câu hỏi luyện tập.", en="At least one practice question is required.")
        )
    return max(10, ceil(question_count * 1.5))


def _build_snapshot(question):
    revision = question.current_revision
    answer_key = getattr(revision, "answer_key", None)
    options_payload = [
        {"key": option.key, "text": option.text, "sort_order": option.sort_order}
        for option in revision.options.all()
    ]
    return {
        "source_question": question,
        "source_revision": revision,
        "difficulty": question.difficulty,
        "question_type": question.question_type,
        "question_text": revision.question_text,
        "options_payload": options_payload,
        "correct_option_keys": list(getattr(answer_key, "correct_option_keys", [])),
        "explanation_text": getattr(answer_key, "sample_answer", ""),
    }


def get_active_practice_session(*, candidate, subject):
    now = timezone.now()
    session = (
        PracticeSession.objects.filter(
            candidate=candidate,
            subject=subject,
            status=PracticeSession.Status.IN_PROGRESS,
        )
        .order_by("-created_at")
        .first()
    )
    if session is None:
        return None
    if _expire_if_needed(session, now=now):
        return None
    return session


@transaction.atomic
def create_practice_session(*, candidate, subject):
    selected_ids = _eligible_objective_question_ids(subject=subject)
    if not selected_ids:
        raise ValidationError(
            t(
                vi="Môn học này chưa có câu hỏi trắc nghiệm để tạo bài luyện tập.",
                en="No objective questions are available for this subject yet.",
            )
        )

    random.shuffle(selected_ids)
    selected_ids = selected_ids[:PRACTICE_TARGET_QUESTION_COUNT]
    total = len(selected_ids)
    duration_minutes = _derive_duration_minutes(total)

    questions = {
        question.id: question
        for question in Question.objects.select_related(
            "current_revision",
            "current_revision__answer_key",
        )
        .prefetch_related("current_revision__options")
        .filter(id__in=selected_ids)
    }

    now = timezone.now()
    session = PracticeSession.objects.create(
        candidate=candidate,
        subject=subject,
        duration_minutes=duration_minutes,
        question_count=total,
        started_at=now,
        expires_at=now + timedelta(minutes=duration_minutes),
        last_activity_at=now,
        total_count=total,
    )

    PracticeSessionQuestion.objects.bulk_create(
        [
            PracticeSessionQuestion(
                session=session,
                sort_order=index,
                **_build_snapshot(questions[question_id]),
            )
            for index, question_id in enumerate(selected_ids, start=1)
        ]
    )
    return session


@transaction.atomic
def save_practice_answer(*, session, session_question, selected_option_keys=None, is_marked_for_review=UNSET):
    if session_question.session_id != session.id:
        raise ValidationError(
            t(vi="Câu hỏi không thuộc phiên luyện tập này.", en="Question does not belong to this practice session.")
        )

    now = _assert_session_is_active(session)

    if selected_option_keys is not None:
        session_question.selected_option_keys = [str(value) for value in selected_option_keys]
        session_question.is_answered = bool(session_question.selected_option_keys)

    if is_marked_for_review is not UNSET:
        session_question.is_marked_for_review = bool(is_marked_for_review)

    session_question.save()
    session.last_activity_at = now
    session.save(update_fields=["last_activity_at", "updated_at"])
    return session_question


@transaction.atomic
def create_practice_autosave_snapshot(*, session, payload=None):
    now = _assert_session_is_active(session)
    snapshot = PracticeAutosaveSnapshot.objects.create(
        session=session,
        payload=payload or {},
        answered_count=session.questions.filter(is_answered=True).count(),
        marked_count=session.questions.filter(is_marked_for_review=True).count(),
    )
    session.last_activity_at = now
    session.save(update_fields=["last_activity_at", "updated_at"])
    return snapshot


@transaction.atomic
def submit_practice_session(*, session):
    if session.status == PracticeSession.Status.SUBMITTED:
        return session

    _assert_session_is_active(session)
    correct_count = 0
    total_count = session.questions.count()

    for question in session.questions.order_by("sort_order"):
        is_correct = sorted(question.selected_option_keys) == sorted(question.correct_option_keys) and bool(
            question.correct_option_keys
        )
        question.is_correct = is_correct
        question.save(update_fields=["is_correct", "updated_at"])
        if is_correct:
            correct_count += 1

    score_percentage = Decimal("0.00")
    if total_count:
        score_percentage = (
            Decimal(correct_count) * Decimal("100.00") / Decimal(total_count)
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    now = timezone.now()
    session.status = PracticeSession.Status.SUBMITTED
    session.submitted_at = now
    session.details_retention_until = now + timedelta(days=settings.PRACTICE_DETAILS_RETENTION_DAYS)
    session.last_activity_at = now
    session.correct_count = correct_count
    session.total_count = total_count
    session.score_percentage = score_percentage
    session.save(
        update_fields=[
            "status",
            "submitted_at",
            "details_retention_until",
            "last_activity_at",
            "correct_count",
            "total_count",
            "score_percentage",
            "updated_at",
        ]
    )
    return session


def get_remaining_seconds(session):
    delta = session.expires_at - timezone.now()
    return max(0, int(delta.total_seconds()))


def user_can_access_practice_session(*, user, session):
    if session.candidate_id == user.id:
        return True
    return bool(user.is_staff and user.has_platform_permission("exams.view"))


def assert_user_can_access_practice_session(*, user, session):
    if not user_can_access_practice_session(user=user, session=session):
        raise PermissionDenied(
            t(vi="Bạn không có quyền truy cập phiên luyện tập này.", en="You do not have access to this practice session.")
        )


def user_has_practice_subject_access(*, user, subject):
    return get_accessible_subject_queryset(user=user).filter(pk=subject.pk).exists()
