from celery import shared_task

from apps.platform_core.health import record_scheduler_heartbeat


@shared_task(name="apps.platform_core.tasks.record_scheduler_heartbeat_task", ignore_result=True)
def record_scheduler_heartbeat_task():
    # Chay duoc nghia la ca beat (lap lich) va worker (thuc thi) deu song.
    return record_scheduler_heartbeat()
