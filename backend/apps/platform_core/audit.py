from collections.abc import Mapping

from .models import AuditEvent


def _extract_ip_address(request) -> str | None:
    if request is None:
        return None
    forwarded_for = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    remote_addr = (request.META.get("REMOTE_ADDR") or "").strip()
    return remote_addr or None


def record_audit_event(
    *,
    actor=None,
    action,
    category,
    severity=AuditEvent.Severity.INFO,
    description="",
    metadata=None,
    request=None,
):
    payload = dict(metadata) if isinstance(metadata, Mapping) else {}
    actor_email = getattr(actor, "email", "") if actor is not None else ""
    actor_name = getattr(actor, "full_name", "") if actor is not None else ""
    request_id = getattr(request, "request_id", "") if request is not None else ""

    return AuditEvent.objects.create(
        actor=actor,
        actor_email=actor_email,
        actor_name=actor_name,
        action=action,
        category=category,
        severity=severity,
        description=description,
        metadata=payload,
        request_id=request_id,
        ip_address=_extract_ip_address(request),
    )
