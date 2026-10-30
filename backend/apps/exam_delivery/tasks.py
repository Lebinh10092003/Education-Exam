from celery import shared_task

from .services import finalize_overdue_sessions


@shared_task(name="apps.exam_delivery.tasks.finalize_overdue_exam_sessions_task")
def finalize_overdue_exam_sessions_task(batch_size=200):
    return finalize_overdue_sessions(batch_size=batch_size)
