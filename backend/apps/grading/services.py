from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.exam_authoring.lifecycle import resolve_exam_phase
from apps.exam_authoring.models import Exam
from apps.exam_delivery.models import SessionAnswer
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
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


def _result_publication_metadata(result):
    return {
        "result_id": result.id,
        "session_id": result.session_id,
        "exam_id": result.session.exam_id,
        "candidate_id": result.session.candidate_id,
    }


def _result_publication_description(result, prefix):
    return f'{prefix} result for "{result.session.candidate.email}" in "{result.session.exam.name}".'


def _record_result_publication_event(*, result, actor, action, description, request=None, extra_metadata=None):
    record_audit_event(
        actor=actor,
        action=action,
        category="results",
        description=description,
        metadata={
            **_result_publication_metadata(result),
            **(extra_metadata or {}),
        },
        request=request,
    )


def _create_result_published_notification(result):
    metadata = _result_publication_metadata(result)
    if Notification.objects.filter(
        recipient=result.session.candidate,
        category=Notification.Category.RESULT,
        metadata__result_id=result.id,
    ).exists():
        return None
    return create_notification(
        recipient=result.session.candidate,
        title=t(vi="Ket qua thi da duoc cong bo", en="Exam result published"),
        message=t(
            vi=f'Ket qua bai thi "{result.session.exam.name}" da san sang de xem.',
            en=f'Result for "{result.session.exam.name}" is ready to view.',
        ),
        category=Notification.Category.RESULT,
        priority=Notification.Priority.MEDIUM,
        action_url=f"/candidate/results/{result.id}",
        metadata=metadata,
    )


def _sync_publication_state_after_score_update(*, result, workflow_status):
    if result.publish_state == Result.PublishState.PUBLISHED:
        return result

    update_fields = []
    if workflow_status == Result.WorkflowStatus.PENDING_GRADING:
        if result.publish_state != Result.PublishState.DRAFT:
            result.publish_state = Result.PublishState.DRAFT
            result.locked_at = None
            result.locked_by = None
            result.scheduled_publish_at = None
            update_fields.extend(["publish_state", "locked_at", "locked_by", "scheduled_publish_at"])
    elif result.publish_state == Result.PublishState.DRAFT:
        result.publish_state = Result.PublishState.REVIEWING
        update_fields.append("publish_state")

    if update_fields:
        result.save(update_fields=[*update_fields, "updated_at"])
    return result


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
    result = _sync_publication_state_after_score_update(result=result, workflow_status=workflow_status)

    current_exam = _get_fresh_exam(session)
    if (
        workflow_status == Result.WorkflowStatus.FINALIZED
        and current_exam.show_results_immediately
        and resolve_exam_phase(current_exam) in {"closed", "results"}
        and result.publish_state != Result.PublishState.PUBLISHED
    ):
        result = publish_result(
            result=result,
            published_by=published_by,
            request=request,
            audit_action="result.auto_published",
            audit_prefix="Auto-published",
        )

    from apps.discipline.services import sync_discipline_after_result_change

    sync_discipline_after_result_change(session=session, actor=published_by, request=request)
    return result


def ensure_result_can_publish(result):
    if result.workflow_status != Result.WorkflowStatus.FINALIZED:
        raise ValidationError(
            t(vi="Chi co ket qua da hoan tat moi co the cong bo.", en="Only finalized results can be published.")
        )
    current_exam = _get_fresh_exam(result.session)
    if resolve_exam_phase(current_exam) not in {"closed", "results"}:
        raise ValidationError(
            t(
                vi="Chỉ có thể công bố kết quả sau khi kỳ thi đã đóng.",
                en="Results can only be published after the exam has closed.",
            )
        )
    return current_exam


@transaction.atomic
def lock_result(*, result, locked_by, note="", request=None):
    if result.workflow_status != Result.WorkflowStatus.FINALIZED:
        raise ValidationError(t(vi="Chi co ket qua da hoan tat moi co the khoa.", en="Only finalized results can be locked."))
    if result.publish_state == Result.PublishState.PUBLISHED:
        raise ValidationError(t(vi="Ket qua da cong bo khong the khoa lai.", en="Published results cannot be locked."))
    if result.publish_state == Result.PublishState.LOCKED:
        return result

    result.publish_state = Result.PublishState.LOCKED
    result.locked_at = timezone.now()
    result.locked_by = locked_by
    if note:
        result.publication_note = note
    result.save(update_fields=["publish_state", "locked_at", "locked_by", "publication_note", "updated_at"])
    _record_result_publication_event(
        result=result,
        actor=locked_by,
        action="result.locked",
        description=_result_publication_description(result, "Locked"),
        request=request,
    )
    return result


@transaction.atomic
def unlock_result(*, result, unlocked_by, note="", request=None):
    if result.publish_state == Result.PublishState.PUBLISHED:
        raise ValidationError(t(vi="Ket qua da cong bo khong the mo khoa.", en="Published results cannot be unlocked."))
    if result.publish_state not in {Result.PublishState.LOCKED, Result.PublishState.SCHEDULED}:
        return result

    result.publish_state = Result.PublishState.REVIEWING
    result.locked_at = None
    result.locked_by = None
    result.scheduled_publish_at = None
    if note:
        result.publication_note = note
    result.save(
        update_fields=[
            "publish_state",
            "locked_at",
            "locked_by",
            "scheduled_publish_at",
            "publication_note",
            "updated_at",
        ]
    )
    _record_result_publication_event(
        result=result,
        actor=unlocked_by,
        action="result.unlocked",
        description=_result_publication_description(result, "Unlocked"),
        request=request,
    )
    return result


@transaction.atomic
def schedule_result_publication(*, result, scheduled_by, scheduled_publish_at, note="", request=None):
    if result.workflow_status != Result.WorkflowStatus.FINALIZED:
        raise ValidationError(t(vi="Chi co ket qua da hoan tat moi co the len lich.", en="Only finalized results can be scheduled."))
    if result.publish_state != Result.PublishState.LOCKED:
        raise ValidationError(t(vi="Can khoa ket qua truoc khi len lich cong bo.", en="Lock the result before scheduling publication."))
    if scheduled_publish_at <= timezone.now():
        raise ValidationError(t(vi="Thoi diem cong bo phai nam trong tuong lai.", en="Scheduled publication time must be in the future."))

    result.publish_state = Result.PublishState.SCHEDULED
    result.scheduled_publish_at = scheduled_publish_at
    if note:
        result.publication_note = note
    result.save(update_fields=["publish_state", "scheduled_publish_at", "publication_note", "updated_at"])
    _record_result_publication_event(
        result=result,
        actor=scheduled_by,
        action="result.scheduled",
        description=_result_publication_description(result, "Scheduled"),
        request=request,
        extra_metadata={"scheduled_publish_at": scheduled_publish_at.isoformat()},
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
def publish_result(*, result, published_by, request=None, audit_action="result.published", audit_prefix="Published"):
    if result.publish_state == Result.PublishState.PUBLISHED:
        return result
    ensure_result_can_publish(result)

    result.publish_state = Result.PublishState.PUBLISHED
    result.published_at = timezone.now()
    result.published_by = published_by
    result.save(update_fields=["publish_state", "published_at", "published_by", "updated_at"])
    _create_result_published_notification(result)
    _record_result_publication_event(
        result=result,
        actor=published_by,
        action=audit_action,
        description=_result_publication_description(result, audit_prefix),
        request=request,
    )
    return result


@transaction.atomic
def publish_results_for_exam(*, exam, published_by, request=None, audit_action="result.exam_bulk_published"):
    published_results = []
    for result in (
        Result.objects.select_related("session", "session__candidate", "session__exam", "session__exam__schedule_window")
        .filter(
            session__exam=exam,
            workflow_status=Result.WorkflowStatus.FINALIZED,
        )
        .exclude(publish_state=Result.PublishState.PUBLISHED)
        .order_by("id")
    ):
        published_results.append(
            publish_result(
                result=result,
                published_by=published_by,
                request=request,
                audit_action=audit_action,
                audit_prefix="Published",
            )
        )
    return published_results


@transaction.atomic
def run_scheduled_publications(*, actor, now=None, request=None):
    current_time = now or timezone.now()
    published_results = []
    for result in (
        Result.objects.select_related("session", "session__candidate", "session__exam", "session__exam__schedule_window")
        .filter(
            workflow_status=Result.WorkflowStatus.FINALIZED,
            publish_state=Result.PublishState.SCHEDULED,
            scheduled_publish_at__lte=current_time,
        )
        .order_by("scheduled_publish_at", "id")
    ):
        published_results.append(
            publish_result(
                result=result,
                published_by=actor,
                request=request,
                audit_action="result.published",
                audit_prefix="Published scheduled",
            )
        )

    if published_results:
        record_audit_event(
            actor=actor,
            action="result.scheduled_publications_ran",
            category="results",
            description=f"Published {len(published_results)} scheduled result(s).",
            metadata={
                "result_ids": [result.id for result in published_results],
                "published_count": len(published_results),
            },
            request=request,
        )
    return published_results
