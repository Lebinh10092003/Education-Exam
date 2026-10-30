import time
from datetime import timedelta
from io import StringIO

import pytest
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import override_settings

from apps.platform_core.health import SCHEDULER_HEARTBEAT_KEY, record_scheduler_heartbeat
from apps.platform_core.tasks import record_scheduler_heartbeat_task


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_readiness_checks_database_and_cache(client):
    payload = client.get("/api/v1/health/ready/").json()
    assert payload["components"]["database"] == "ok"
    assert payload["components"]["cache"] == "ok"
    assert payload["components"]["scheduler"] == "skipped"


@pytest.mark.django_db
@override_settings(SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS=120)
def test_readiness_fails_without_scheduler_heartbeat(client):
    response = client.get("/api/v1/health/ready/")
    assert response.status_code == 503
    assert response.json()["components"]["scheduler"].startswith("error")

    record_scheduler_heartbeat_task()
    response = client.get("/api/v1/health/ready/")
    assert response.status_code == 200
    assert response.json()["components"]["scheduler"] == "ok"


@pytest.mark.django_db
@override_settings(SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS=120)
def test_readiness_fails_with_stale_heartbeat(client):
    record_scheduler_heartbeat(now=time.time() - 600)
    assert client.get("/api/v1/health/ready/").status_code == 503


def test_check_scheduler_heartbeat_command():
    with pytest.raises(CommandError):
        call_command("check_scheduler_heartbeat", "--max-age", "60")
    cache.set(SCHEDULER_HEARTBEAT_KEY, time.time(), timeout=60)
    out = StringIO()
    call_command("check_scheduler_heartbeat", "--max-age", "60", stdout=out)
    assert out.getvalue().startswith("ok")


@pytest.mark.django_db
def test_active_exam_sessions_command_counts_only_live_sessions(subject, admin_user, candidate_user):
    from django.utils import timezone

    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.models import ExamSession

    exam = create_exam(
        name="Ops Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=60,
        passing_score=50,
        max_attempts=5,
    )
    now = timezone.now()
    cases = [
        (ExamSession.Status.IN_PROGRESS, now + timedelta(minutes=30), now),  # dang thi
        (ExamSession.Status.IN_PROGRESS, now + timedelta(minutes=30), now - timedelta(hours=2)),  # bo do
        (ExamSession.Status.IN_PROGRESS, now - timedelta(minutes=1), now),  # het gio
        (ExamSession.Status.SUBMITTED, now + timedelta(minutes=30), now),  # da nop
    ]
    for attempt, (status, expires_at, last_activity_at) in enumerate(cases, start=1):
        ExamSession.objects.create(
            exam=exam,
            candidate=candidate_user,
            exam_version=exam.current_version,
            attempt_number=attempt,
            status=status,
            started_at=now - timedelta(hours=3),
            expires_at=expires_at,
            last_activity_at=last_activity_at,
        )

    out = StringIO()
    call_command("active_exam_sessions", stdout=out)
    assert out.getvalue().strip() == "1"
