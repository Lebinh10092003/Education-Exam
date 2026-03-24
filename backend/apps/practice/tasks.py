from celery import shared_task

from .retention import cleanup_expired_practice_details


@shared_task(name="apps.practice.tasks.cleanup_expired_practice_details_task")
def cleanup_expired_practice_details_task(batch_size=100):
    return cleanup_expired_practice_details(batch_size=batch_size)
