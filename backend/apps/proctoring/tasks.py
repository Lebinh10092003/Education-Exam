from celery import shared_task

from .retention import cleanup_expired_proctor_evidence


@shared_task(name="apps.proctoring.tasks.cleanup_expired_proctor_evidence_task")
def cleanup_expired_proctor_evidence_task(batch_size=100):
    return cleanup_expired_proctor_evidence(batch_size=batch_size)
