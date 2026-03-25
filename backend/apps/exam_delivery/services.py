import random
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.exam_authoring.models import Exam, ExamAssignment
from apps.platform_core.i18n import t

from .models import AutosaveSnapshot, ExamSession, SessionAnswer, SessionQuestion, Submission

UNSET = object()


def _candidate_has_access(*, exam, candidate):
    return ExamAssignment.objects.filter(
        Q(exam=exam, user=candidate)
        | Q(
            exam=exam,
            group__memberships__user=candidate,
            group__memberships__is_active=True,
        )
    ).exists()


def _assert_candidate_can_start(*, exam, candidate, now):
    if not _candidate_has_access(exam=exam, candidate=candidate):
        raise PermissionDenied(t(vi="Bạn chưa được phân vào bài thi này.", en="You are not assigned to this exam."))
    if exam.mode != Exam.Mode.EXAM:
        raise ValidationError(t(vi="Mục này không phải bài thi để làm bài.", en="This item is not a deliverable exam."))
    if exam.current_version_id is None:
        raise ValidationError(t(vi="Bài thi này chưa có phiên bản có thể phân phối.", en="This exam does not have a deliverable version."))
    if exam.status not in {Exam.Status.SCHEDULED, Exam.Status.OPEN}:
        raise ValidationError(t(vi="Bài thi này hiện không thể mở cho thí sinh.", en="This exam is not available for delivery."))

    schedule_window = getattr(exam, "schedule_window", None)
    if schedule_window and schedule_window.opens_at and schedule_window.opens_at > now:
        raise ValidationError(t(vi="Bài thi này chưa mở.", en="This exam is not open yet."))
    if schedule_window and schedule_window.closes_at and schedule_window.closes_at <= now:
        raise ValidationError(t(vi="Bài thi này đã đóng.", en="This exam is already closed."))


def _expire_if_needed(session, *, now):
    if session.status == ExamSession.Status.IN_PROGRESS and session.expires_at <= now:
        session.status = ExamSession.Status.EXPIRED
        session.save(update_fields=["status", "updated_at"])
        return True
    return False


def _sum_points(items):
    total = Decimal("0.00")
    for item in items:
        total += item.points
    return total


def _build_session_questions(*, session, exam_items):
    items = list(exam_items)
    if session.exam.shuffle_questions and len(items) > 1:
        seeded_rng = random.Random(f"{session.exam_id}:{session.candidate_id}:{session.attempt_number}")
        seeded_rng.shuffle(items)

    SessionQuestion.objects.bulk_create(
        [
            SessionQuestion(
                session=session,
                exam_item=item,
                question_revision=item.question_revision,
                sort_order=index,
                points=item.points,
            )
            for index, item in enumerate(items, start=1)
        ]
    )


@transaction.atomic
def start_or_resume_session(*, exam, candidate):
    now = timezone.now()
    _assert_candidate_can_start(exam=exam, candidate=candidate, now=now)

    current_session = (
        ExamSession.objects.select_related("exam", "exam_version")
        .filter(exam=exam, candidate=candidate, status=ExamSession.Status.IN_PROGRESS)
        .order_by("-attempt_number")
        .first()
    )
    if current_session:
        if not _expire_if_needed(current_session, now=now):
            return current_session

    attempts_used = ExamSession.objects.filter(exam=exam, candidate=candidate).count()
    if attempts_used >= exam.max_attempts:
        raise ValidationError(t(vi="Bạn không còn lượt làm bài cho bài thi này.", en="No attempts remaining for this exam."))

    exam_items = list(
        exam.current_version.items.select_related("question_revision", "question_revision__question").order_by("sort_order")
    )
    max_score = _sum_points(exam_items)
    expires_at = now + timedelta(minutes=exam.duration_minutes)
    schedule_window = getattr(exam, "schedule_window", None)
    if schedule_window and schedule_window.closes_at and schedule_window.closes_at < expires_at:
        expires_at = schedule_window.closes_at
    if expires_at <= now:
        raise ValidationError(t(vi="Bài thi này không thể bắt đầu nữa.", en="This exam can no longer be started."))

    session = ExamSession.objects.create(
        exam=exam,
        candidate=candidate,
        exam_version=exam.current_version,
        status=ExamSession.Status.IN_PROGRESS,
        attempt_number=attempts_used + 1,
        started_at=now,
        expires_at=expires_at,
        last_activity_at=now,
        max_score=max_score,
    )
    _build_session_questions(session=session, exam_items=exam_items)
    return session


def _assert_session_is_active(session):
    now = timezone.now()
    if _expire_if_needed(session, now=now):
        raise ValidationError(t(vi="Phiên thi này đã hết hạn.", en="This session has expired."))
    if session.status != ExamSession.Status.IN_PROGRESS:
        raise ValidationError(t(vi="Phiên thi này hiện không nhận câu trả lời.", en="This session is not accepting answers."))
    return now


@transaction.atomic
def save_session_answer(
    *,
    session,
    session_question,
    selected_option_keys=None,
    answer_text=None,
    is_marked_for_review=UNSET,
):
    if session_question.session_id != session.id:
        raise ValidationError(t(vi="Câu hỏi không thuộc phiên thi này.", en="Question does not belong to this session."))

    now = _assert_session_is_active(session)
    answer, _ = SessionAnswer.objects.get_or_create(session_question=session_question)

    if selected_option_keys is not None:
        answer.selected_option_keys = [str(option_key) for option_key in selected_option_keys]
    if answer_text is not None:
        answer.answer_text = answer_text
    answer.is_answered = bool(answer.selected_option_keys or answer.answer_text.strip())
    answer.save()

    if is_marked_for_review is not UNSET:
        session_question.is_marked_for_review = bool(is_marked_for_review)
        session_question.save(update_fields=["is_marked_for_review", "updated_at"])

    session.last_activity_at = now
    session.save(update_fields=["last_activity_at", "updated_at"])
    return answer


@transaction.atomic
def create_autosave_snapshot(*, session, payload=None):
    now = _assert_session_is_active(session)
    snapshot = AutosaveSnapshot.objects.create(
        session=session,
        payload=payload or {},
        answered_count=session.questions.filter(answer__is_answered=True).count(),
        marked_count=session.questions.filter(is_marked_for_review=True).count(),
    )
    session.last_activity_at = now
    session.save(update_fields=["last_activity_at", "updated_at"])
    return snapshot


def build_autosave_receipt(*, session, payload=None):
    now = _assert_session_is_active(session)
    return {
        "id": None,
        "answered_count": session.questions.filter(answer__is_answered=True).count(),
        "marked_count": session.questions.filter(is_marked_for_review=True).count(),
        "payload": payload or {},
        "created_at": now,
    }


@transaction.atomic
def submit_session(*, session, submitted_by):
    if hasattr(session, "submission"):
        try:
            from apps.grading.services import initialize_grading_for_submission
        except ModuleNotFoundError:
            return session.submission
        initialize_grading_for_submission(session=session)
        return session.submission

    now = _assert_session_is_active(session)
    objective_score = Decimal("0.00")
    max_score = Decimal("0.00")
    manual_grading_required = False
    answered_count = 0

    for session_question in session.questions.select_related(
        "question_revision__question",
        "question_revision__answer_key",
    ).order_by("sort_order"):
        max_score += session_question.points
        answer = getattr(session_question, "answer", None)
        if answer and answer.is_answered:
            answered_count += 1

        question_type = session_question.question_revision.question.question_type
        if question_type in {"multiple_choice", "true_false"}:
            expected_keys = sorted(getattr(session_question.question_revision.answer_key, "correct_option_keys", []))
            selected_keys = sorted(getattr(answer, "selected_option_keys", [])) if answer else []
            is_correct = bool(expected_keys) and selected_keys == expected_keys
            awarded_points = session_question.points if is_correct else Decimal("0.00")
            if answer is None:
                answer = SessionAnswer.objects.create(
                    session_question=session_question,
                    selected_option_keys=[],
                    answer_text="",
                    is_answered=False,
                )
            answer.is_correct = is_correct
            answer.awarded_points = awarded_points
            answer.save(update_fields=["is_correct", "awarded_points", "updated_at"])
            objective_score += awarded_points
        else:
            manual_grading_required = True

    session.status = ExamSession.Status.SUBMITTED
    session.submitted_at = now
    session.last_activity_at = now
    session.objective_score = objective_score
    session.max_score = max_score
    session.manual_grading_required = manual_grading_required
    session.save(
        update_fields=[
            "status",
            "submitted_at",
            "last_activity_at",
            "objective_score",
            "max_score",
            "manual_grading_required",
            "updated_at",
        ]
    )
    submission = Submission.objects.create(
        session=session,
        submitted_by=submitted_by,
        source=Submission.Source.MANUAL,
        answered_count=answered_count,
    )
    try:
        from apps.grading.services import initialize_grading_for_submission
    except ModuleNotFoundError:
        return submission
    initialize_grading_for_submission(session=session)
    return submission


def get_remaining_seconds(session):
    delta = session.expires_at - timezone.now()
    return max(0, int(delta.total_seconds()))


def user_can_access_session(*, user, session):
    if session.candidate_id == user.id:
        return True
    return bool(user.is_staff and user.has_platform_permission("exams.view"))
