from django.utils import timezone

from .models import PracticeSession


def cleanup_expired_practice_details(*, now=None, batch_size=100):
    now = now or timezone.now()
    queryset = PracticeSession.objects.filter(
        status=PracticeSession.Status.SUBMITTED,
        details_retention_until__isnull=False,
        details_retention_until__lte=now,
        details_purged_at__isnull=True,
    ).order_by("details_retention_until", "id")
    if batch_size is not None:
        queryset = queryset[:batch_size]

    processed = 0
    deleted = 0
    failed = 0

    for session in queryset:
        processed += 1
        try:
            session.questions.all().delete()
            session.autosave_snapshots.all().delete()
            session.details_purged_at = now
            session.save(update_fields=["details_purged_at", "updated_at"])
            deleted += 1
        except Exception:
            failed += 1

    return {
        "processed": processed,
        "deleted": deleted,
        "failed": failed,
    }
