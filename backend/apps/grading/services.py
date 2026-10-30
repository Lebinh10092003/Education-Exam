from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.exam_authoring.lifecycle import resolve_exam_phase
from apps.exam_authoring.models import Exam
from apps.exam_delivery.models import SessionAnswer
from apps.notifications.models import Notification
from apps.notifications.services import create_notifications_for_permission
from apps.platform_core.audit import record_audit_event
from apps.platform_core.i18n import t

from .models import ManualGrade, ManualGradingTask, Result


def _as_decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(t(vi="Gia tri so thap phan khong hop le.", en="Invalid decimal value.")) from exc


def _calculate_percentage(*, total_score, max_score):
    if not max_score:
        return Decimal("0.00")
    return ((total_score / max_score) * Decimal("100")).quantize(Decimal("0.01"))


def _calculate_passed(*, session, percentage):
    return percentage >= Decimal(str(session.exam.passing_score))


def _get_fresh_exam(session):
    return Exam.objects.select_related("schedule_window").get(pk=session.exam_id)


def _sync_result_state(*, session, published_by=None, request=None):
    manual_score = Decimal("0.00")
    pending_tasks = 0

    for task in session.manual_grading_tasks.select_related("manual_grade").all():
        if task.status != ManualGradingTask.Status.GRADED or not hasattr(task, "manual_grade"):
            pending_tasks += 1
            continue
        manual_score += task.manual_grade.score_awarded

    original_total_score = Decimal(session.objective_score) + manual_score
    max_score = Decimal(session.max_score)
    original_percentage = _calculate_percentage(total_score=original_total_score, max_score=max_score)
    workflow_status = (
        Result.WorkflowStatus.PENDING_GRADING if pending_tasks else Result.WorkflowStatus.FINALIZED
    )
    passed = None if workflow_status == Result.WorkflowStatus.PENDING_GRADING else _calculate_passed(
        session=session,
        percentage=original_percentage,
    )

    defaults = {
        "workflow_status": workflow_status,
        "objective_score": session.objective_score,
        "manual_score": manual_score,
        "original_total_score": original_total_score,
        "original_percentage": original_percentage,
        "penalty_percent_applied": Decimal("0.00"),
        "final_total_score": original_total_score,
        "final_percentage": original_percentage,
        "total_score": original_total_score,
        "max_score": max_score,
        "percentage": original_percentage,
        "passed": passed,
    }
    result, _ = Result.objects.update_or_create(session=session, defaults=defaults)

    current_exam = _get_fresh_exam(session)
    if (
        workflow_status == Result.WorkflowStatus.FINALIZED
        and current_exam.show_results_immediately
        and resolve_exam_phase(current_exam) in {"closed", "results"}
        and result.publish_state != Result.PublishState.PUBLISHED
    ):
        result.publish_state = Result.PublishState.PUBLISHED
        result.published_at = timezone.now()
        result.published_by = published_by
        result.save(update_fields=["publish_state", "published_at", "published_by", "updated_at"])
        if published_by is not None:
            record_audit_event(
                actor=published_by,
                action="result.auto_published",
                category="results",
                description=f'Auto-published result for "{session.candidate.email}" in "{session.exam.name}".',
                metadata={
                    "result_id": result.id,
                    "session_id": session.id,
                    "exam_id": session.exam_id,
                    "candidate_id": session.candidate_id,
                },
                request=request,
            )

    from apps.discipline.services import sync_discipline_after_result_change

    sync_discipline_after_result_change(session=session, actor=published_by, request=request)
    return result


@transaction.atomic
def initialize_grading_for_submission(*, session):
    created_task_count = 0
    for session_question in session.questions.select_related(
        "question_revision__question",
    ).order_by("sort_order"):
        if session_question.question_revision.question.question_type != "essay":
            continue
        _, created = ManualGradingTask.objects.get_or_create(
            session=session,
            session_question=session_question,
            defaults={"max_points": session_question.points},
        )
        if created:
            created_task_count += 1
        SessionAnswer.objects.get_or_create(
            session_question=session_question,
            defaults={
                "selected_option_keys": [],
                "answer_text": "",
                "is_answered": False,
            },
        )

    # In accordance with optimization requests, admin notifications for each student submission are disabled.
    # if created_task_count:
    #     create_notifications_for_permission(
    #         permission_code="grading.manage",
    #         title="Manual grading required",
    #         message=(
    #             f'{session.candidate.full_name or session.candidate.email} submitted "{session.exam.name}" '
    #             f"and {created_task_count} response(s) require manual grading."
    #         ),
    #         category=Notification.Category.GRADING,
    #         priority=Notification.Priority.MEDIUM,
    #         action_url="/manual-grading",
    #         metadata={
    #             "session_id": session.id,
    #             "exam_id": session.exam_id,
    #             "candidate_id": session.candidate_id,
    #             "manual_task_count": created_task_count,
    #         },
    #     )

    return _sync_result_state(session=session)


@transaction.atomic
def grade_manual_task(*, task, grader, score_awarded, feedback="", request=None):
    awarded_score = _as_decimal(score_awarded)
    if awarded_score < Decimal("0.00") or awarded_score > task.max_points:
        raise ValidationError(
            t(
                vi=f"Diem phai nam trong khoang tu 0 den {task.max_points}.",
                en=f"Score must be between 0 and {task.max_points}.",
            )
        )

    graded_at = timezone.now()
    ManualGrade.objects.update_or_create(
        task=task,
        defaults={
            "graded_by": grader,
            "score_awarded": awarded_score,
            "feedback": feedback,
            "graded_at": graded_at,
        },
    )
    task.status = ManualGradingTask.Status.GRADED
    task.graded_by = grader
    task.graded_at = graded_at
    task.save(update_fields=["status", "graded_by", "graded_at", "updated_at"])

    answer, _ = SessionAnswer.objects.get_or_create(
        session_question=task.session_question,
        defaults={
            "selected_option_keys": [],
            "answer_text": "",
            "is_answered": False,
        },
    )
    answer.awarded_points = awarded_score
    answer.is_correct = None
    answer.save(update_fields=["awarded_points", "is_correct", "updated_at"])

    _sync_result_state(session=task.session, published_by=grader, request=request)
    record_audit_event(
        actor=grader,
        action="grading.manual_graded",
        category="grading",
        description=f'Graded manual response for "{task.session.candidate.email}" in "{task.session.exam.name}".',
        metadata={
            "task_id": task.id,
            "session_id": task.session_id,
            "exam_id": task.session.exam_id,
            "candidate_id": task.session.candidate_id,
            "score_awarded": str(awarded_score),
            "max_points": str(task.max_points),
        },
        request=request,
    )
    return task


@transaction.atomic
def publish_result(*, result, published_by, request=None):
    if result.workflow_status != Result.WorkflowStatus.FINALIZED:
        raise ValidationError(t(vi="Chi co ket qua da hoan tat moi co the cong bo.", en="Only finalized results can be published."))
    current_exam = _get_fresh_exam(result.session)
    if resolve_exam_phase(current_exam) not in {"closed", "results"}:
        raise ValidationError(
            t(
                vi="Chỉ có thể công bố kết quả sau khi kỳ thi đã đóng.",
                en="Results can only be published after the exam has closed.",
            )
        )

    result.publish_state = Result.PublishState.PUBLISHED
    result.published_at = timezone.now()
    result.published_by = published_by
    result.save(update_fields=["publish_state", "published_at", "published_by", "updated_at"])
    record_audit_event(
        actor=published_by,
        action="result.published",
        category="results",
        description=f'Published result for "{result.session.candidate.email}" in "{result.session.exam.name}".',
        metadata={
            "result_id": result.id,
            "session_id": result.session_id,
            "exam_id": result.session.exam_id,
            "candidate_id": result.session.candidate_id,
        },
        request=request,
    )
    return result


BULK_GRADE_LIMIT = 200


def bulk_grade_manual_tasks(*, grades, grader, request=None):
    """
    Cham nhieu bai tu luan trong 1 lan (vd. cham theo tung cau cho ca phong thi).
    Moi bai cham trong transaction rieng: 1 bai loi khong lam hong cac bai con lai.
    grades: [{"task_id": int, "score_awarded": number, "feedback": str}]
    """
    if len(grades) > BULK_GRADE_LIMIT:
        raise ValidationError(
            t(
                vi=f"Mỗi lần chấm tối đa {BULK_GRADE_LIMIT} bài.",
                en=f"At most {BULK_GRADE_LIMIT} tasks per request.",
            )
        )
    task_ids = [item["task_id"] for item in grades]
    tasks = {
        task.id: task
        for task in ManualGradingTask.objects.select_related(
            "session", "session__exam", "session__candidate", "session_question"
        ).filter(id__in=task_ids)
    }
    graded, errors = [], []
    for item in grades:
        task = tasks.get(item["task_id"])
        if task is None:
            errors.append({"task_id": item["task_id"], "error": "Không tìm thấy bài cần chấm."})
            continue
        try:
            with transaction.atomic():
                grade_manual_task(
                    task=task,
                    grader=grader,
                    score_awarded=item["score_awarded"],
                    feedback=item.get("feedback", ""),
                    request=request,
                )
            graded.append(task.id)
        except ValidationError as exc:
            detail = exc.detail[0] if isinstance(exc.detail, list) and exc.detail else exc.detail
            errors.append({"task_id": task.id, "error": str(detail)})
    return {"graded_count": len(graded), "graded_task_ids": graded, "errors": errors}


def grade_blank_answers_as_zero(*, exam_id, grader, feedback="Bỏ trống, không làm bài.", request=None):
    """Bai tu luan bo trong (chua cham) -> 0 diem, de nguoi cham chi tap trung vao bai co noi dung."""
    pending = ManualGradingTask.objects.select_related(
        "session", "session__exam", "session__candidate", "session_question", "session_question__answer"
    ).filter(session__exam_id=exam_id, status=ManualGradingTask.Status.PENDING)
    blank_ids = [
        task.id
        for task in pending
        if not (getattr(getattr(task.session_question, "answer", None), "answer_text", "") or "").strip()
    ]
    return _grade_in_chunks(blank_ids, grader, feedback, request)


def _grade_in_chunks(task_ids, grader, feedback, request):
    total = {"graded_count": 0, "graded_task_ids": [], "errors": []}
    for start in range(0, len(task_ids), BULK_GRADE_LIMIT):
        chunk = bulk_grade_manual_tasks(
            grades=[{"task_id": task_id, "score_awarded": 0, "feedback": feedback}
                    for task_id in task_ids[start:start + BULK_GRADE_LIMIT]],
            grader=grader,
            request=request,
        )
        total["graded_count"] += chunk["graded_count"]
        total["graded_task_ids"] += chunk["graded_task_ids"]
        total["errors"] += chunk["errors"]
    return total


def grading_progress_by_question(*, exam_id):
    """Tien do cham theo tung cau tu luan cua de: tong / da cham / con lai / bo trong."""
    from django.db.models import Count, Q

    rows = (
        ManualGradingTask.objects.filter(session__exam_id=exam_id)
        .values(
            "session_question__exam_item_id",
            "session_question__question_revision__question_id",
            "session_question__question_revision__question_text",
        )
        .annotate(
            total=Count("id"),
            graded=Count("id", filter=Q(status=ManualGradingTask.Status.GRADED)),
            blank_pending=Count(
                "id",
                filter=Q(status=ManualGradingTask.Status.PENDING)
                & (Q(session_question__answer__isnull=True) | Q(session_question__answer__answer_text="")),
            ),
        )
        .order_by("session_question__exam_item_id")
    )
    return [
        {
            "exam_item_id": row["session_question__exam_item_id"],
            "question_id": row["session_question__question_revision__question_id"],
            "question_preview": (row["session_question__question_revision__question_text"] or "")[:160],
            "total": row["total"],
            "graded": row["graded"],
            "pending": row["total"] - row["graded"],
            "blank_pending": row["blank_pending"],
        }
        for row in rows
    ]


# ============================== Goi y diem (AI qua MCP) ==================================
SUGGESTION_FLAGS = {
    "low_confidence",  # AI khong chac chan
    "off_topic",  # lac de
    "possible_copy",  # giong bai khac bat thuong
    "prompt_injection",  # bai lam chua cau lenh nham dieu khien nguoi/AI cham
    "unreadable",  # khong doc duoc / sai dinh dang
    "needs_teacher",  # ly do khac can giao vien xem
}
ESSAY_BATCH_MAX = 50


def build_essay_grading_batch(*, exam_id, question_id=None, limit=20, include_suggested=False):
    """
    Lo bai tu luan cua 1 cau de AI cham goi y. Bai lam duoc AN DANH (chi co task_id, khong ten/email)
    de tranh thien vi va khong gui thong tin ca nhan cua hoc sinh ra dich vu AI ben ngoai.
    """
    limit = max(1, min(int(limit or 20), ESSAY_BATCH_MAX))
    pending = ManualGradingTask.objects.filter(session__exam_id=exam_id, status=ManualGradingTask.Status.PENDING)
    if not include_suggested:
        pending = pending.filter(suggested_score__isnull=True)
    if question_id is None:
        question_id = (
            pending.order_by("session_question__exam_item__sort_order", "id")
            .values_list("session_question__question_revision__question_id", flat=True)
            .first()
        )
        if question_id is None:
            return {"exam_id": int(exam_id), "question": None, "answers": [], "remaining": 0}

    tasks = list(
        pending.filter(session_question__question_revision__question_id=question_id)
        .select_related(
            "session_question__answer",
            "session_question__question_revision",
            "session_question__question_revision__answer_key",
        )
        .order_by("id")
    )
    remaining = len(tasks)
    tasks = tasks[:limit]
    question = None
    if tasks:
        revision = tasks[0].session_question.question_revision
        answer_key = getattr(revision, "answer_key", None)
        question = {
            "question_id": revision.question_id,
            "question_text": revision.question_text,
            "max_points": str(tasks[0].max_points),
            "essay_rubric": getattr(answer_key, "essay_rubric", "") if answer_key else "",
            "sample_answer": getattr(answer_key, "sample_answer", "") if answer_key else "",
            "acceptable_answers": getattr(answer_key, "acceptable_answers", []) if answer_key else [],
        }
    answers = []
    for task in tasks:
        text = (getattr(getattr(task.session_question, "answer", None), "answer_text", "") or "").strip()
        answers.append(
            {
                "task_id": task.id,
                "max_points": str(task.max_points),
                "answer_text": text,
                "is_blank": not text,
                "word_count": len(text.split()),
                "current_suggestion": (
                    {"score": str(task.suggested_score), "feedback": task.suggested_feedback}
                    if task.suggested_score is not None
                    else None
                ),
            }
        )
    return {
        "exam_id": int(exam_id),
        "question": question,
        "answers": answers,
        "remaining": remaining,
        "returned": len(answers),
    }


def save_grade_suggestions(*, suggestions, user, source="ai"):
    """Luu diem goi y. KHONG thay doi diem chinh thuc, ket qua hay trang thai bai."""
    if len(suggestions) > BULK_GRADE_LIMIT:
        raise ValidationError(
            t(vi=f"Mỗi lần tối đa {BULK_GRADE_LIMIT} gợi ý.", en=f"At most {BULK_GRADE_LIMIT} suggestions per request.")
        )
    tasks = {task.id: task for task in ManualGradingTask.objects.filter(id__in=[s["task_id"] for s in suggestions])}
    now = timezone.now()
    saved, errors = [], []
    for item in suggestions:
        task = tasks.get(item["task_id"])
        if task is None:
            errors.append({"task_id": item["task_id"], "error": "Không tìm thấy bài cần chấm."})
            continue
        if task.status != ManualGradingTask.Status.PENDING:
            errors.append({"task_id": task.id, "error": "Bài đã có điểm chính thức, không ghi gợi ý."})
            continue
        try:
            score = _as_decimal(item["score"])
        except ValidationError:
            errors.append({"task_id": task.id, "error": "Điểm gợi ý không hợp lệ."})
            continue
        if score < 0 or score > task.max_points:
            errors.append({"task_id": task.id, "error": f"Điểm gợi ý phải trong khoảng 0–{task.max_points}."})
            continue
        flags = [flag for flag in (item.get("flags") or []) if flag in SUGGESTION_FLAGS]
        task.suggested_score = score
        task.suggested_feedback = str(item.get("feedback") or "")[:4000]
        task.suggestion_rationale = str(item.get("rationale") or "")[:8000]
        task.suggestion_flags = flags
        task.suggestion_source = str(source or "ai")[:64]
        task.suggested_by = user
        task.suggested_at = now
        task.save(
            update_fields=[
                "suggested_score",
                "suggested_feedback",
                "suggestion_rationale",
                "suggestion_flags",
                "suggestion_source",
                "suggested_by",
                "suggested_at",
                "updated_at",
            ]
        )
        saved.append(task.id)
    return {"saved_count": len(saved), "saved_task_ids": saved, "errors": errors}


def approve_grade_suggestions(*, task_ids, grader, include_flagged=False, request=None):
    """
    Giao vien duyet: bien diem goi y thanh diem chinh thuc (dung chung luong cham hang loat).
    Bai bi gan co (lac de, nghi chep bai, chen lenh...) bi bo qua tru khi include_flagged=True.
    """
    tasks = ManualGradingTask.objects.filter(
        id__in=task_ids, status=ManualGradingTask.Status.PENDING, suggested_score__isnull=False
    )
    grades, skipped = [], []
    for task in tasks:
        if task.suggestion_flags and not include_flagged:
            skipped.append({"task_id": task.id, "flags": task.suggestion_flags})
            continue
        grades.append({"task_id": task.id, "score_awarded": task.suggested_score, "feedback": task.suggested_feedback})
    missing = sorted(set(task_ids) - {task.id for task in tasks})
    result = bulk_grade_manual_tasks(grades=grades, grader=grader, request=request) if grades else {
        "graded_count": 0,
        "graded_task_ids": [],
        "errors": [],
    }
    if result["graded_count"]:
        record_audit_event(
            actor=grader,
            action="grading.suggestions_approved",
            category="grading",
            description=f"Approved {result['graded_count']} suggested essay grade(s).",
            metadata={"task_ids": result["graded_task_ids"]},
            request=request,
        )
    result["skipped_flagged"] = skipped
    result["not_found_or_not_suggested"] = missing
    return result
