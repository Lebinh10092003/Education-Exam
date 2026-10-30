import random
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.exam_authoring.models import Exam, ExamAssignment, ExamItem
from apps.exam_authoring.lifecycle import (
    assert_exam_phase_allows_start,
    assert_session_allows_interaction,
    resolve_exam_phase,
)
from apps.question_bank.models import Question
from apps.platform_core.i18n import t

from .models import AutosaveSnapshot, ExamSession, SessionAnswer, SessionQuestion, Submission

UNSET = object()


def _progress_counts_for_session(session):
    prefetched_questions = getattr(session, "_prefetched_objects_cache", {}).get("questions")
    if prefetched_questions is not None:
        return {
            "answered_count": sum(
                1
                for question in prefetched_questions
                if getattr(getattr(question, "answer", None), "is_answered", False)
            ),
            "marked_count": sum(1 for question in prefetched_questions if question.is_marked_for_review),
        }

    return session.questions.aggregate(
        answered_count=Count("id", filter=Q(answer__is_answered=True)),
        marked_count=Count("id", filter=Q(is_marked_for_review=True)),
    )


def set_session_cache(session):
    cache_key = f"exam_session_cache:{session.id}"
    has_published_results = session.exam.sessions.filter(result__publish_state="published").exists()
    progress_counts = _progress_counts_for_session(session)
    
    cached_data = {
        "candidate_id": session.candidate_id,
        "status": session.status,
        "expires_at": session.expires_at.timestamp(),
        "paused_at": session.paused_at.timestamp() if session.paused_at else None,
        "remaining_seconds_at_pause": session.remaining_seconds_at_pause,
        "exam_id": session.exam_id,
        "exam_status": session.exam.status,
        "exam_opens_at": session.exam.schedule_window.opens_at.timestamp() if (hasattr(session.exam, "schedule_window") and session.exam.schedule_window and session.exam.schedule_window.opens_at) else None,
        "exam_closes_at": session.exam.schedule_window.closes_at.timestamp() if (hasattr(session.exam, "schedule_window") and session.exam.schedule_window and session.exam.schedule_window.closes_at) else None,
        "has_published_results": has_published_results,
        "answered_count": progress_counts["answered_count"],
        "marked_count": progress_counts["marked_count"],
        "last_activity_at": session.last_activity_at.timestamp() if session.last_activity_at else None,
    }
    cache.set(cache_key, cached_data, timeout=3600)
    return cached_data


def _should_write_session_activity(session, now):
    interval_seconds = max(int(getattr(settings, "EXAM_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS", 30)), 0)
    if interval_seconds == 0 or session.last_activity_at is None:
        return True
    return now - session.last_activity_at >= timedelta(seconds=interval_seconds)


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
    assert_exam_phase_allows_start(exam, now=now)


def _setting_seconds(name, default):
    return max(int(getattr(settings, name, default) or 0), 0)


def _is_paused(session):
    return session.paused_at is not None and session.remaining_seconds_at_pause is not None


def get_submission_deadline(session):
    """Moc cuoi cung de nop dung han = het gio lam bai + thoi gian an han."""
    return session.expires_at + timedelta(seconds=_setting_seconds("EXAM_SUBMISSION_GRACE_SECONDS", 300))


def is_answering_closed(session, *, now=None):
    """Da het gio lam bai (khong nhan cau tra loi moi), tinh ca do tre dong bo cho phep."""
    if _is_paused(session) or session.status != ExamSession.Status.IN_PROGRESS:
        return False
    now = now or timezone.now()
    tolerance = timedelta(seconds=_setting_seconds("EXAM_ANSWER_SYNC_TOLERANCE_SECONDS", 30))
    return now >= session.expires_at + tolerance


def is_in_grace_period(session, *, now=None):
    if _is_paused(session) or session.status != ExamSession.Status.IN_PROGRESS:
        return False
    now = now or timezone.now()
    return session.expires_at <= now < get_submission_deadline(session)


def is_overdue(session, *, now=None):
    """Qua ca thoi gian an han ma chua nop -> can tu nop va danh dau nop muon."""
    if _is_paused(session) or session.status != ExamSession.Status.IN_PROGRESS:
        return False
    now = now or timezone.now()
    return now >= get_submission_deadline(session)


def _sum_points(items):
    total = Decimal("0.00")
    for item in items:
        total += item.points
    return total


def _random_rule_candidate_pool(*, session, rule):
    """
    Danh sach (question_id, current_revision_id) sap xep theo id cho 1 luat ngau nhien.
    Khi nhieu thi sinh vao thi cung luc, chi query ngan hang cau hoi 1 lan moi TTL
    thay vi tai toan bo ngan hang cho tung thi sinh.
    """
    ttl_seconds = max(int(getattr(settings, "EXAM_RANDOM_POOL_CACHE_TTL_SECONDS", 0) or 0), 0)
    cache_key = f"exam_random_pool:{session.exam_version_id}:{rule.pk}:{session.exam.subject_id}"
    if ttl_seconds:
        cached_pool = cache.get(cache_key)
        if cached_pool is not None:
            return cached_pool

    queryset = Question.objects.filter(subject_id=session.exam.subject_id, current_revision__isnull=False)
    if rule.difficulty:
        queryset = queryset.filter(difficulty=rule.difficulty)
    if rule.question_type:
        queryset = queryset.filter(question_type=rule.question_type)
    if rule.tag_ids:
        queryset = queryset.filter(tags__id__in=rule.tag_ids)
    pool = [
        (question_id, revision_id)
        for question_id, revision_id in queryset.values_list("id", "current_revision_id").distinct().order_by("id")
    ]
    if ttl_seconds:
        cache.set(cache_key, pool, ttl_seconds)
    return pool


def _build_session_questions(*, session, exam_items):
    manual_items = [item for item in exam_items if item.source == ExamItem.Source.MANUAL]
    static_random_items = [item for item in exam_items if item.source == ExamItem.Source.RANDOM]

    random_rules = list(session.exam_version.random_rules.order_by("sort_order"))
    total_rule_count = sum(rule.count for rule in random_rules)

    paired_specs = []  # list of tuples (exam_item, question_revision)

    if len(static_random_items) == total_rule_count and total_rule_count > 0:
        seeded_rng = random.Random(f"{session.exam_id}:{session.candidate_id}:{session.attempt_number}")
        excluded_ids = {item.question_revision.question_id for item in manual_items}

        static_random_ptr = 0

        for rule in random_rules:
            pool = _random_rule_candidate_pool(session=session, rule=rule)
            # Loai tru trong Python thay vi query lai: thu tu (theo id) giu nguyen nhu truoc.
            candidates = [entry for entry in pool if entry[0] not in excluded_ids]
            if len(candidates) < rule.count:
                raise ValidationError(t(
                    vi=f"Không đủ câu hỏi trong ngân hàng để sinh đề ngẫu nhiên theo yêu cầu (Luật #{rule.sort_order}).",
                    en=f"Not enough questions available in the question bank to satisfy random rule #{rule.sort_order}."
                ))

            # Shuffle candidates deterministically based on seed
            seeded_rng.shuffle(candidates)
            selected_questions = candidates[:rule.count]

            for question_id, revision_id in selected_questions:
                excluded_ids.add(question_id)
                item = static_random_items[static_random_ptr]
                static_random_ptr += 1
                paired_specs.append((item, revision_id))
    else:
        # Fallback to static items if no random rules or mismatch
        for item in static_random_items:
            paired_specs.append((item, item.question_revision_id))

    # Add all manual items
    for item in manual_items:
        paired_specs.append((item, item.question_revision_id))

    # Shuffle paired_specs if required by exam configurations
    if session.exam.shuffle_questions and len(paired_specs) > 1:
        seeded_rng = random.Random(f"{session.exam_id}:{session.candidate_id}:{session.attempt_number}")
        seeded_rng.shuffle(paired_specs)

    SessionQuestion.objects.bulk_create(
        [
            SessionQuestion(
                session=session,
                exam_item=item,
                question_revision_id=revision_id,
                sort_order=index,
                points=item.points,
            )
            for index, (item, revision_id) in enumerate(paired_specs, start=1)
        ]
    )


@transaction.atomic
def start_or_resume_session(*, exam, candidate):
    now = timezone.now()
    current_session = (
        ExamSession.objects.select_related("exam", "exam_version")
        .filter(exam=exam, candidate=candidate, status=ExamSession.Status.IN_PROGRESS)
        .order_by("-attempt_number")
        .first()
    )
    if current_session:
        if not is_overdue(current_session, now=now):
            # Ke ca trong thoi gian an han: tra ve phien de thi sinh bam nop.
            set_session_cache(current_session)
            return current_session
        # Qua han ma chua nop (vd. dong trinh duyet): tu nop va danh dau nop muon.
        finalize_overdue_session(session=current_session)
        current_session.refresh_from_db()
        # Het luot thi: tra ve bai vua nop (khong bao loi, neu khong transaction se huy luon ban nop).
        if ExamSession.objects.filter(exam=exam, candidate=candidate).count() >= exam.max_attempts:
            return current_session

    latest_session = (
        ExamSession.objects.select_related("exam", "exam_version")
        .filter(exam=exam, candidate=candidate)
        .order_by("-attempt_number")
        .first()
    )
    if latest_session and resolve_exam_phase(exam, now=now) in {"paused", "closed", "results"} and latest_session.status in {
        ExamSession.Status.SUBMITTED,
        ExamSession.Status.EXPIRED,
        ExamSession.Status.TERMINATED,
    }:
        return latest_session

    _assert_candidate_can_start(exam=exam, candidate=candidate, now=now)

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
    set_session_cache(session)
    return session


def _assert_session_is_active(session):
    now = timezone.now()
    if session.status != ExamSession.Status.IN_PROGRESS:
        raise ValidationError(t(vi="Phiên thi này hiện không nhận câu trả lời.", en="This session is not accepting answers."))
    # Lich thi co the dong dung luc het gio; van cho dong bo cau tra loi trong khoang tre cho phep.
    within_answer_window = _is_paused(session) or not is_answering_closed(session, now=now)
    interaction_time = assert_session_allows_interaction(session, now=now, allow_closed=within_answer_window)
    if not within_answer_window:
        raise ValidationError(
            t(
                vi="Đã hết giờ làm bài. Bạn chỉ có thể nộp bài.",
                en="Time is up. You can only submit the exam now.",
            )
        )
    return interaction_time


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

    was_answered = answer.is_answered
    was_marked = session_question.is_marked_for_review

    if selected_option_keys is not None:
        answer.selected_option_keys = [str(option_key) for option_key in selected_option_keys]
    if answer_text is not None:
        answer.answer_text = answer_text
    answer.is_answered = bool(answer.selected_option_keys or answer.answer_text.strip())
    answer.save(update_fields=["selected_option_keys", "answer_text", "is_answered", "updated_at"])

    if is_marked_for_review is not UNSET and session_question.is_marked_for_review != bool(is_marked_for_review):
        session_question.is_marked_for_review = bool(is_marked_for_review)
        session_question.save(update_fields=["is_marked_for_review", "updated_at"])

    if _should_write_session_activity(session, now):
        session.last_activity_at = now
        session.save(update_fields=["last_activity_at", "updated_at"])

    # Update counts in-place in Redis cache if cache exists
    cache_key = f"exam_session_cache:{session.id}"
    cached_data = cache.get(cache_key)
    if cached_data:
        answered_diff = 0
        if not was_answered and answer.is_answered:
            answered_diff = 1
        elif was_answered and not answer.is_answered:
            answered_diff = -1

        marked_diff = 0
        if not was_marked and session_question.is_marked_for_review:
            marked_diff = 1
        elif was_marked and not session_question.is_marked_for_review:
            marked_diff = -1

        if answered_diff != 0 or marked_diff != 0:
            cached_data["answered_count"] += answered_diff
            cached_data["marked_count"] += marked_diff
        
        cached_data["last_activity_at"] = now.timestamp()
        cache.set(cache_key, cached_data, timeout=3600)

    return answer


@transaction.atomic
def create_autosave_snapshot(*, session, payload=None):
    now = _assert_session_is_active(session)
    progress_counts = _progress_counts_for_session(session)
    snapshot = AutosaveSnapshot.objects.create(
        session=session,
        payload=payload or {},
        answered_count=progress_counts["answered_count"],
        marked_count=progress_counts["marked_count"],
    )
    session.last_activity_at = now
    session.save(update_fields=["last_activity_at", "updated_at"])
    return snapshot


def build_autosave_receipt(*, session, payload=None):
    now = _assert_session_is_active(session)
    progress_counts = _progress_counts_for_session(session)
    return {
        "id": None,
        "answered_count": progress_counts["answered_count"],
        "marked_count": progress_counts["marked_count"],
        "payload": payload or {},
        "created_at": now,
    }


@transaction.atomic
def submit_session(*, session, submitted_by, source=Submission.Source.MANUAL, force=False, is_late=None):
    # Khoa dong phien de thi sinh bam nop va tac vu tu nop khong cung tao 2 ban nop.
    locked = ExamSession.objects.select_for_update().only("id", "status").get(pk=session.pk)
    existing_submission = Submission.objects.filter(session_id=session.pk).first()
    if existing_submission is not None:
        try:
            from apps.grading.services import initialize_grading_for_submission
        except ModuleNotFoundError:
            return existing_submission
        initialize_grading_for_submission(session=session)
        return existing_submission
    session.status = locked.status

    now = timezone.now()
    if not force and session.status != ExamSession.Status.IN_PROGRESS:
        raise ValidationError(
            t(vi="Phiên thi này hiện không nhận bài nộp.", en="This session is not accepting submissions.")
        )
    # Nop bai luon duoc phep ke ca khi lich thi da dong (het gio / an han); chi chan khi dang tam dung.
    assert_session_allows_interaction(session, now=now, allow_closed=True)
    if is_late is None:
        is_late = not _is_paused(session) and now >= get_submission_deadline(session)
    objective_score = Decimal("0.00")
    max_score = Decimal("0.00")
    manual_grading_required = False
    answered_count = 0

    answers_to_update = []
    for session_question in session.questions.select_related(
        "question_revision__question",
        "question_revision__answer_key",
        "answer",
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
                answer = SessionAnswer(
                    session_question=session_question,
                    selected_option_keys=[],
                    answer_text="",
                    is_answered=False,
                )
                answer.save()  # cần id trước khi bulk_update
            answer.is_correct = is_correct
            answer.awarded_points = awarded_points
            answers_to_update.append(answer)
            objective_score += awarded_points
        else:
            manual_grading_required = True

    # Ghi tất cả kết quả chấm điểm trong 1 lần bulk_update thay vì N lần save()
    if answers_to_update:
        SessionAnswer.objects.bulk_update(answers_to_update, ["is_correct", "awarded_points", "updated_at"])

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
    cache.delete(f"exam_session_cache:{session.id}")
    submission = Submission.objects.create(
        session=session,
        submitted_by=submitted_by,
        source=source,
        answered_count=answered_count,
        is_late=bool(is_late),
    )
    try:
        from apps.grading.services import initialize_grading_for_submission
    except ModuleNotFoundError:
        return submission
    initialize_grading_for_submission(session=session)
    return submission


def finalize_overdue_session(*, session):
    """Tu nop bai cho phien da qua thoi gian an han; cau chua lam tinh la sai."""
    return submit_session(
        session=session,
        submitted_by=None,
        source=Submission.Source.AUTO_TIMEOUT,
        force=True,
        is_late=True,
    )


def finalize_overdue_sessions(*, now=None, batch_size=200):
    """Chay dinh ky (Celery beat): tu nop moi phien qua han ma thi sinh chua bam nop."""
    import logging

    logger = logging.getLogger(__name__)
    now = now or timezone.now()
    grace = timedelta(seconds=_setting_seconds("EXAM_SUBMISSION_GRACE_SECONDS", 300))
    candidate_ids = list(
        ExamSession.objects.filter(
            status=ExamSession.Status.IN_PROGRESS,
            paused_at__isnull=True,
            expires_at__lte=now - grace,
            submission__isnull=True,
        )
        .order_by("expires_at", "id")
        .values_list("id", flat=True)[:batch_size]
    )
    finalized = 0
    failed = 0
    for session_id in candidate_ids:
        session = (
            ExamSession.objects.select_related("exam", "exam__schedule_window", "candidate")
            .filter(pk=session_id)
            .first()
        )
        if session is None or not is_overdue(session, now=now):
            continue
        try:
            finalize_overdue_session(session=session)
            finalized += 1
        except Exception:
            failed += 1
            logger.exception("Unable to auto-submit overdue exam session.", extra={"session_id": session_id})
    return {"checked": len(candidate_ids), "finalized": finalized, "failed": failed}


def get_remaining_seconds(session):
    if session.paused_at is not None and session.remaining_seconds_at_pause is not None:
        return int(session.remaining_seconds_at_pause)
    delta = session.expires_at - timezone.now()
    return max(0, int(delta.total_seconds()))


def user_can_access_session(*, user, session):
    if session.candidate_id == user.id:
        return True
    return bool(user.is_staff and user.has_platform_permission("exams.view"))
