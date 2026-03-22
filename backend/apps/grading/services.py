from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.exam_delivery.models import SessionAnswer
from apps.notifications.models import Notification
from apps.notifications.services import create_notifications_for_permission
from apps.platform_core.audit import record_audit_event

from .models import ManualGrade, ManualGradingTask, Result


def _as_decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError("Invalid decimal value.") from exc


def _calculate_percentage(*, total_score, max_score):
    if not max_score:
        return Decimal("0.00")
    return ((total_score / max_score) * Decimal("100")).quantize(Decimal("0.01"))


def _calculate_passed(*, session, percentage):
    return percentage >= Decimal(str(session.exam.passing_score))


def _sync_result_state(*, session, published_by=None, request=None):
    manual_score = Decimal("0.00")
    pending_tasks = 0

    for task in session.manual_grading_tasks.select_related("manual_grade").all():
        if task.status != ManualGradingTask.Status.GRADED or not hasattr(task, "manual_grade"):
            pending_tasks += 1
            continue
        manual_score += task.manual_grade.score_awarded

    total_score = Decimal(session.objective_score) + manual_score
    max_score = Decimal(session.max_score)
    percentage = _calculate_percentage(total_score=total_score, max_score=max_score)
    workflow_status = (
        Result.WorkflowStatus.PENDING_GRADING if pending_tasks else Result.WorkflowStatus.FINALIZED
    )
    passed = None if workflow_status == Result.WorkflowStatus.PENDING_GRADING else _calculate_passed(
        session=session,
        percentage=percentage,
    )

    defaults = {
        "workflow_status": workflow_status,
        "objective_score": session.objective_score,
        "manual_score": manual_score,
        "total_score": total_score,
        "max_score": max_score,
        "percentage": percentage,
        "passed": passed,
    }
    result, _ = Result.objects.update_or_create(session=session, defaults=defaults)

    if (
        workflow_status == Result.WorkflowStatus.FINALIZED
        and session.exam.show_results_immediately
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

    if created_task_count:
        create_notifications_for_permission(
            permission_code="grading.manage",
            title="Manual grading required",
            message=(
                f'{session.candidate.full_name or session.candidate.email} submitted "{session.exam.name}" '
                f"and {created_task_count} response(s) require manual grading."
            ),
            category=Notification.Category.GRADING,
            priority=Notification.Priority.MEDIUM,
            action_url="/manual-grading",
            metadata={
                "session_id": session.id,
                "exam_id": session.exam_id,
                "candidate_id": session.candidate_id,
                "manual_task_count": created_task_count,
            },
        )

    return _sync_result_state(session=session)


@transaction.atomic
def grade_manual_task(*, task, grader, score_awarded, feedback="", request=None):
    awarded_score = _as_decimal(score_awarded)
    if awarded_score < Decimal("0.00") or awarded_score > task.max_points:
        raise ValidationError(f"Score must be between 0 and {task.max_points}.")

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
        raise ValidationError("Only finalized results can be published.")

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
