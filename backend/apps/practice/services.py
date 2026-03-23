import random
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.platform_core.i18n import t
from apps.question_bank.models import Question

from .models import PracticeAutosaveSnapshot, PracticeSession, PracticeSessionQuestion

UNSET = object()
OBJECTIVE_TYPES = [Question.Type.MULTIPLE_CHOICE, Question.Type.TRUE_FALSE]
DIFFICULTY_LEVELS = [Question.Difficulty.EASY, Question.Difficulty.MEDIUM, Question.Difficulty.HARD]


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


def _validate_difficulty_counts(difficulty_counts):
    normalized = {}
    total = 0
    for difficulty in DIFFICULTY_LEVELS:
        value = int(difficulty_counts.get(difficulty, 0))
        if value < 0:
            raise ValidationError(
                t(vi="Số lượng câu hỏi không được âm.", en="Question counts must not be negative.")
            )
        normalized[difficulty] = value
        total += value
    if total <= 0:
        raise ValidationError(
            t(vi="Phải chọn ít nhất một câu hỏi luyện tập.", en="At least one practice question is required.")
        )
    return normalized, total


def _pick_question_ids(*, subject, difficulty, count):
    eligible_ids = list(
        Question.objects.filter(
            subject=subject,
            difficulty=difficulty,
            question_type__in=OBJECTIVE_TYPES,
            current_revision__isnull=False,
        ).values_list("id", flat=True)
    )
    if len(eligible_ids) < count:
        raise ValidationError(
            t(
                vi="Ngân hàng câu hỏi không đủ để tạo đề luyện tập theo cấu hình đã chọn.",
                en="Not enough practice questions are available for the requested configuration.",
            )
        )
    if count == 0:
        return []
    return random.sample(eligible_ids, count)


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


@transaction.atomic
def create_practice_session(*, candidate, subject, duration_minutes, difficulty_counts):
    if duration_minutes <= 0:
        raise ValidationError(
            t(vi="Thời lượng luyện tập phải lớn hơn 0.", en="Practice duration must be greater than 0.")
        )

    normalized_counts, total = _validate_difficulty_counts(difficulty_counts)
    selected_ids = []
    for difficulty, count in normalized_counts.items():
        selected_ids.extend(_pick_question_ids(subject=subject, difficulty=difficulty, count=count))
    random.shuffle(selected_ids)

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
    session.last_activity_at = now
    session.correct_count = correct_count
    session.total_count = total_count
    session.score_percentage = score_percentage
    session.save(
        update_fields=[
            "status",
            "submitted_at",
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
