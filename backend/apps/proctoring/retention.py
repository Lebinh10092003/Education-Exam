import logging

from django.utils import timezone

from .models import ProctorEvidence


logger = logging.getLogger(__name__)


def evidence_file_is_available(evidence: ProctorEvidence, *, now=None) -> bool:
    now = now or timezone.now()
    if evidence.deleted_at is not None:
        return False
    if evidence.expires_at <= now:
        return False
    return bool(evidence.file)


def safe_evidence_file_url(evidence: ProctorEvidence, *, now=None) -> str:
    if not evidence_file_is_available(evidence, now=now):
        return ""
    try:
        return evidence.file.url if evidence.file else ""
    except ValueError:
        return ""


def cleanup_expired_proctor_evidence(*, now=None, batch_size=100):
    now = now or timezone.now()
    queryset = ProctorEvidence.objects.filter(
        deleted_at__isnull=True,
        expires_at__lte=now,
    ).order_by("expires_at", "id")
    if batch_size is not None:
        queryset = queryset[:batch_size]

    processed = 0
    deleted = 0
    failed = 0

    for evidence in queryset:
        processed += 1
        try:
            if evidence.file:
                evidence.file.delete(save=False)
            evidence.deleted_at = now
            evidence.deletion_error = ""
            evidence.save(update_fields=["file", "deleted_at", "deletion_error", "updated_at"])
            deleted += 1
        except Exception as exc:
            evidence.deletion_error = str(exc)
            evidence.save(update_fields=["deletion_error", "updated_at"])
            failed += 1
            logger.exception(
                "Unable to delete expired proctor evidence.",
                extra={"evidence_id": evidence.id, "session_id": evidence.session_id},
            )

    return {
        "processed": processed,
        "deleted": deleted,
        "failed": failed,
    }
