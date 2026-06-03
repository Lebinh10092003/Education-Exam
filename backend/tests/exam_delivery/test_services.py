from datetime import timedelta

import pytest
from django.utils import timezone


def _build_assigned_exam(
    *,
    subject,
    admin_user,
    candidate_user,
    status="scheduled",
    opening_at=None,
    closing_at=None,
):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code=f"SCH{candidate_user.id or 'X'}")
    group = CandidateGroup.objects.create(name=f"Computer Science - Year {candidate_user.id or 1}")
    GroupMembership.objects.create(group=group, user=candidate_user)
    objective_question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        correct_option_keys=["A"],
    )
    essay_question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="medium",
        question_type="essay",
        question_text="Explain the binomial theorem.",
        tags=["Algebra"],
        essay_rubric="State formula and explain usage.",
    )
    now = timezone.now()
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status=status,
        duration_minutes=120,
        passing_score=60,
        max_attempts=2,
        opening_at=opening_at or (now - timedelta(hours=1)),
        closing_at=closing_at or (now + timedelta(hours=2)),
        manual_question_ids=[objective_question.id, essay_question.id],
        group_ids=[group.id],
    )
    return exam


@pytest.mark.django_db
def test_start_or_resume_session_creates_snapshot_questions_from_current_exam_version(
    subject,
    admin_user,
    candidate_user,
):
    from apps.exam_delivery.services import start_or_resume_session

    exam = _build_assigned_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    session = start_or_resume_session(exam=exam, candidate=candidate_user)

    assert session.questions.count() == exam.current_version.items.count()
    assert session.attempt_number == 1


@pytest.mark.django_db
def test_start_or_resume_returns_existing_in_progress_session(subject, admin_user, candidate_user):
    from apps.exam_delivery.services import start_or_resume_session

    exam = _build_assigned_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    first = start_or_resume_session(exam=exam, candidate=candidate_user)
    second = start_or_resume_session(exam=exam, candidate=candidate_user)

    assert second.id == first.id


@pytest.mark.django_db
def test_save_answer_updates_session_answer_and_autosave_snapshot(subject, admin_user, candidate_user):
    from apps.exam_delivery.services import create_autosave_snapshot, save_session_answer, start_or_resume_session

    exam = _build_assigned_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    session_question = session.questions.order_by("sort_order").first()

    answer = save_session_answer(
        session=session,
        session_question=session_question,
        selected_option_keys=["A"],
        is_marked_for_review=True,
    )
    snapshot = create_autosave_snapshot(session=session, payload={"source": "manual-test"})

    assert answer.selected_option_keys == ["A"]
    assert session_question.is_marked_for_review is True
    assert snapshot.answered_count == 1
    assert snapshot.marked_count == 1


@pytest.mark.django_db
def test_save_answer_throttles_session_activity_writes(settings, subject, admin_user, candidate_user):
    from apps.exam_delivery.models import ExamSession
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session

    settings.EXAM_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS = 30
    exam = _build_assigned_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    session_question = session.questions.order_by("sort_order").first()
    original_activity_at = session.last_activity_at

    save_session_answer(
        session=session,
        session_question=session_question,
        selected_option_keys=["A"],
    )
    session.refresh_from_db()

    assert session.last_activity_at == original_activity_at

    stale_activity_at = timezone.now() - timedelta(seconds=31)
    ExamSession.objects.filter(pk=session.pk).update(last_activity_at=stale_activity_at)
    session.refresh_from_db()

    save_session_answer(
        session=session,
        session_question=session_question,
        selected_option_keys=["A"],
    )
    session.refresh_from_db()

    assert session.last_activity_at > stale_activity_at


@pytest.mark.django_db
def test_submit_session_is_idempotent_and_auto_scores_objective_items(subject, admin_user, candidate_user):
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session

    exam = _build_assigned_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    objective_question = session.questions.filter(question_revision__question__question_type="multiple_choice").first()
    essay_question = session.questions.filter(question_revision__question__question_type="essay").first()
    save_session_answer(
        session=session,
        session_question=objective_question,
        selected_option_keys=["A"],
    )
    save_session_answer(
        session=session,
        session_question=essay_question,
        answer_text="Use the formula (a+b)^n.",
    )

    first_submission = submit_session(session=session, submitted_by=candidate_user)
    repeated_submission = submit_session(session=session, submitted_by=candidate_user)
    session.refresh_from_db()

    assert repeated_submission.id == first_submission.id
    assert session.status == "submitted"
    assert float(session.objective_score) == 1.0
    assert session.manual_grading_required is True
