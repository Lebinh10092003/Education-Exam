"""Kiem tra suc khoe that su cua cac thanh phan (dung cho /health/ready/ va healthcheck container)."""

import time

from django.conf import settings
from django.core.cache import cache
from django.db import connection

SCHEDULER_HEARTBEAT_KEY = "health:scheduler-heartbeat"


def record_scheduler_heartbeat(now=None):
    timestamp = now if now is not None else time.time()
    # Giu khoa lau hon nguong canh bao de phan biet "cham" voi "chua tung chay".
    cache.set(SCHEDULER_HEARTBEAT_KEY, timestamp, timeout=24 * 3600)
    return timestamp


def scheduler_heartbeat_age():
    """So giay ke tu nhip tim cuoi; None neu chua co."""
    value = cache.get(SCHEDULER_HEARTBEAT_KEY)
    if value is None:
        return None
    return max(0.0, time.time() - float(value))


def check_database():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:  # noqa: BLE001 - bao cao moi loi ket noi
        return f"error: {exc.__class__.__name__}"
    return "ok"


def check_cache():
    try:
        cache.set("health:ping", "1", timeout=30)
        if cache.get("health:ping") != "1":
            return "error: read-back mismatch"
    except Exception as exc:  # noqa: BLE001
        return f"error: {exc.__class__.__name__}"
    return "ok"


def check_scheduler():
    max_age = getattr(settings, "SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS", 0)
    if not max_age:
        return "skipped"
    try:
        age = scheduler_heartbeat_age()
    except Exception as exc:  # noqa: BLE001
        return f"error: {exc.__class__.__name__}"
    if age is None:
        return "error: no heartbeat (celery beat/worker down?)"
    if age > max_age:
        return f"error: last heartbeat {int(age)}s ago"
    return "ok"


def collect_components():
    return {
        "database": check_database(),
        "cache": check_cache(),
        "scheduler": check_scheduler(),
        "storage": "object-storage" if getattr(settings, "USE_S3_STORAGE", False) else "filesystem",
        "evidence_storage": getattr(settings, "PROCTORING_EVIDENCE_STORAGE", "local"),
    }


def is_healthy(components):
    return not any(str(value).startswith("error") for value in components.values())
