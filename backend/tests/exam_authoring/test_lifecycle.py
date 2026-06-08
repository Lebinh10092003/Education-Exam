from datetime import timedelta

import pytest
from django.utils import timezone


def _build_exam(*, subject, admin_user, candidate_user, status="scheduled", opening_offset_hours=-1, closing_offset_hours=2):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    import uuid
    School.objects.create(
        name=f"Lifecycle School {candidate_user.id}-{uuid.uuid4().hex[:8]}",
        code=f"LF-{uuid.uuid4().hex[:6]}",
    )
    group = CandidateGroup.objects.create(name=f"Lifecycle Group {candidate_user.id}")
    GroupMembership.objects.create(group=group, user=candidate_user)
    question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is 1 + 1?",
        tags=["Arithmetic"],
        options=[{"key": "A", "text": "2"}, {"key": "B", "text": "3"}],
        correct_option_keys=["A"],
    )
    now = timezone.now()
    return create_exam(
        name=f"Lifecycle Exam {candidate_user.id}",
        subject=subject,
        created_by=admin_user,
        status=status,
        duration_minutes=60,
        passing_score=60,
        max_attempts=1,
        opening_at=now + timedelta(hours=opening_offset_hours),
        closing_at=now + timedelta(hours=closing_offset_hours),
        manual_question_ids=[question.id],
        group_ids=[group.id],
    )


@pytest.mark.django_db
def test_resolve_exam_phase_distinguishes_scheduled_open_closed_and_results(subject, admin_user, candidate_user):
    from apps.exam_authoring.lifecycle import resolve_exam_phase
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session
    from apps.grading.services import publish_result

    scheduled_exam = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        status="scheduled",
        opening_offset_hours=1,
        closing_offset_hours=2,
    )
    open_exam = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        status="open",
        opening_offset_hours=-1,
        closing_offset_hours=2,
    )
    closed_exam = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        status="closed",
        opening_offset_hours=-4,
        closing_offset_hours=-1,
    )
    result_exam = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        status="open",
        opening_offset_hours=-4,
        closing_offset_hours=2,
    )
    session = start_or_resume_session(exam=result_exam, candidate=candidate_user)
    question = session.questions.first()
    save_session_answer(session=session, session_question=question, selected_option_keys=["A"])
    submit_session(session=session, submitted_by=candidate_user)
    result_exam.status = "closed"
    result_exam.save(update_fields=["status", "updated_at"])
    publish_result(result=session.result, published_by=admin_user)

    assert resolve_exam_phase(scheduled_exam) == "scheduled"
    assert resolve_exam_phase(open_exam) == "open"
    assert resolve_exam_phase(closed_exam) == "closed"
    assert resolve_exam_phase(result_exam) == "results"


@pytest.mark.django_db
def test_transition_exam_status_freezes_resumes_and_closes_sessions(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import transition_exam_status
    from apps.exam_delivery.models import ExamSession
    from apps.exam_delivery.services import start_or_resume_session

    exam = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        status="open",
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    original_expires_at = session.expires_at

    # Test open -> scheduled transition
    transition_exam_status(exam=exam, next_status="scheduled", actor=admin_user)
    session.refresh_from_db()
    assert exam.status == "scheduled"
    assert session.paused_at is not None
    assert session.remaining_seconds_at_pause is not None

    # Test scheduled -> open transition
    transition_exam_status(exam=exam, next_status="open", actor=admin_user)
    session.refresh_from_db()
    assert exam.status == "open"
    assert session.paused_at is None
    assert session.remaining_seconds_at_pause is None

    transition_exam_status(exam=exam, next_status="paused", actor=admin_user)
    session.refresh_from_db()
    assert session.paused_at is not None
    assert session.remaining_seconds_at_pause is not None

    transition_exam_status(exam=exam, next_status="open", actor=admin_user, bonus_minutes=5)
    session.refresh_from_db()
    assert session.paused_at is None
    assert session.remaining_seconds_at_pause is None
    assert session.expires_at > original_expires_at

    transition_exam_status(exam=exam, next_status="closed", actor=admin_user)
    session.refresh_from_db()
    assert exam.status == "closed"
    assert session.status == ExamSession.Status.SUBMITTED
    assert session.submission.source == "forced_close"


@pytest.mark.django_db
def test_sync_exam_lifecycle_auto_opens_and_closes_exams(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import sync_exam_lifecycle

    should_open = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        status="scheduled",
        opening_offset_hours=-1,
        closing_offset_hours=2,
    )
    should_close = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        status="open",
        opening_offset_hours=-4,
        closing_offset_hours=-1,
    )

    transitioned_exam_ids = sync_exam_lifecycle()
    should_open.refresh_from_db()
    should_close.refresh_from_db()

    assert should_open.id in transitioned_exam_ids
    assert should_close.id in transitioned_exam_ids
    assert should_open.status == "open"
    assert should_close.status == "closed"
