from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from tests.proctoring.utils import build_active_session


def _shift_expiry(session, *, seconds_ago):
    from apps.exam_delivery.models import ExamSession

    expires_at = timezone.now() - timedelta(seconds=seconds_ago)
    ExamSession.objects.filter(pk=session.pk).update(expires_at=expires_at)
    session.refresh_from_db()
    return session


def _first_question(session):
    return session.questions.select_related("session").order_by("sort_order").first()


@pytest.mark.django_db
def test_answer_rejected_after_time_up_but_allowed_within_sync_tolerance(settings, subject, admin_user, candidate_user):
    from apps.exam_delivery.services import save_session_answer

    settings.EXAM_ANSWER_SYNC_TOLERANCE_SECONDS = 30
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    question = _first_question(session)

    _shift_expiry(session, seconds_ago=10)
    answer = save_session_answer(session=session, session_question=question, selected_option_keys=["A"])
    assert answer.is_answered is True

    _shift_expiry(session, seconds_ago=60)
    with pytest.raises(ValidationError):
        save_session_answer(session=session, session_question=question, selected_option_keys=["B"])


@pytest.mark.django_db
def test_submit_during_grace_period_is_on_time(settings, subject, admin_user, candidate_user):
    from apps.exam_delivery.services import submit_session

    settings.EXAM_SUBMISSION_GRACE_SECONDS = 300
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    _shift_expiry(session, seconds_ago=120)

    submission = submit_session(session=session, submitted_by=candidate_user)

    session.refresh_from_db()
    assert session.status == "submitted"
    assert submission.is_late is False


@pytest.mark.django_db
def test_submit_after_grace_period_is_marked_late(settings, subject, admin_user, candidate_user):
    from apps.exam_delivery.services import submit_session

    settings.EXAM_SUBMISSION_GRACE_SECONDS = 300
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    _shift_expiry(session, seconds_ago=400)

    submission = submit_session(session=session, submitted_by=candidate_user)

    assert submission.is_late is True


@pytest.mark.django_db
def test_submitting_twice_returns_same_submission(subject, admin_user, candidate_user):
    from apps.exam_delivery.models import Submission
    from apps.exam_delivery.services import submit_session

    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    first = submit_session(session=session, submitted_by=candidate_user)
    second = submit_session(session=session, submitted_by=candidate_user, force=True)

    assert first.id == second.id
    assert Submission.objects.filter(session=session).count() == 1


@pytest.mark.django_db
def test_finalize_overdue_sessions_auto_submits_late_and_scores_unanswered_as_wrong(
    settings, subject, admin_user, candidate_user
):
    from apps.exam_delivery.models import SessionAnswer
    from apps.exam_delivery.services import finalize_overdue_sessions

    settings.EXAM_SUBMISSION_GRACE_SECONDS = 300
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    _shift_expiry(session, seconds_ago=301)

    result = finalize_overdue_sessions()

    session.refresh_from_db()
    assert result["finalized"] == 1
    assert session.status == "submitted"
    assert session.submission.is_late is True
    assert session.submission.source == "auto_timeout"
    assert session.submission.submitted_by is None
    answer = SessionAnswer.objects.get(session_question__session=session)
    assert answer.is_answered is False
    assert answer.is_correct is False
    assert session.objective_score == 0


@pytest.mark.django_db
def test_finalize_overdue_sessions_skips_sessions_still_in_grace(settings, subject, admin_user, candidate_user):
    from apps.exam_delivery.services import finalize_overdue_sessions

    settings.EXAM_SUBMISSION_GRACE_SECONDS = 300
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    _shift_expiry(session, seconds_ago=60)

    assert finalize_overdue_sessions()["finalized"] == 0
    session.refresh_from_db()
    assert session.status == "in_progress"


@pytest.mark.django_db
def test_resume_during_grace_returns_session_and_after_grace_auto_submits(
    settings, subject, admin_user, candidate_user
):
    from apps.exam_delivery.services import start_or_resume_session

    settings.EXAM_SUBMISSION_GRACE_SECONDS = 300
    exam, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    _shift_expiry(session, seconds_ago=60)
    resumed = start_or_resume_session(exam=exam, candidate=candidate_user)
    assert resumed.id == session.id
    assert resumed.status == "in_progress"

    _shift_expiry(session, seconds_ago=600)
    resumed = start_or_resume_session(exam=exam, candidate=candidate_user)
    session.refresh_from_db()
    assert session.status == "submitted"
    assert session.submission.is_late is True
    assert resumed.id == session.id


@pytest.mark.django_db
def test_session_api_exposes_deadline_and_submit_accepts_auto_flag(settings, api_client, subject, admin_user, candidate_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    settings.EXAM_SUBMISSION_GRACE_SECONDS = 300
    exam, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(candidate_user).access_token}")

    payload = api_client.post(f"/api/v1/exams/{exam.id}/start-session/").json()
    assert payload["submission_grace_seconds"] == 300
    assert payload["submission_deadline"]
    assert payload["is_late"] is False

    _shift_expiry(session, seconds_ago=400)
    response = api_client.post(f"/api/v1/exam-sessions/{session.id}/submit/", {"auto_submit": True}, format="json")

    assert response.status_code == 200
    assert response.json()["is_late"] is True
    session.refresh_from_db()
    assert session.submission.source == "auto_timeout"
