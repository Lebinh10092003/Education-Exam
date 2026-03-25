from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone


def _build_exam(*, subject, admin_user, candidates, question_count=1, passing_score=60, max_attempts=2):
    from apps.exam_authoring.services import create_exam
    from apps.question_bank.services import create_question

    question_ids = []
    for index in range(question_count):
        question = create_question(
            subject=subject,
            created_by=admin_user,
            difficulty="easy",
            question_type="multiple_choice",
            question_text=f"Question {index + 1}",
            tags=["Discipline"],
            options=[{"key": "A", "text": "Correct"}, {"key": "B", "text": "Incorrect"}],
            correct_option_keys=["A"],
        )
        question_ids.append(question.id)

    now = timezone.now()
    return create_exam(
        name=f"Discipline Exam {now.timestamp()}",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=90,
        passing_score=passing_score,
        max_attempts=max_attempts,
        opening_at=now - timedelta(hours=1),
        closing_at=now + timedelta(hours=1),
        manual_question_ids=question_ids,
        user_ids=[candidate.id for candidate in candidates],
    )


def _submit_attempt(*, exam, candidate, correct_count):
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session

    session = start_or_resume_session(exam=exam, candidate=candidate)
    questions = list(session.questions.order_by("sort_order"))
    for index, question in enumerate(questions):
        answer_key = "A" if index < correct_count else "B"
        save_session_answer(session=session, session_question=question, selected_option_keys=[answer_key])
    submit_session(session=session, submitted_by=candidate)
    session.refresh_from_db()
    session.result.refresh_from_db()
    return session


def _create_violation_case(*, session, candidate, severity="warning", message="Violation detected."):
    from apps.proctoring.services import record_proctor_event

    event = record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity=severity,
        metadata={"message": message},
        reported_by=candidate,
    )
    return event.violation_cases.get()


@pytest.mark.django_db
def test_recompute_record_selects_highest_scoring_attempt(subject, admin_user, candidate_user):
    from apps.discipline.services import recompute_disciplinary_record

    exam = _build_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user], max_attempts=3)
    highest_session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=1)
    _submit_attempt(exam=exam, candidate=candidate_user, correct_count=0)

    record = recompute_disciplinary_record(exam=exam, candidate=candidate_user, actor=admin_user)

    assert record.selected_session_id == highest_session.id
    assert record.original_total_score == Decimal("1.00")
    assert record.final_total_score == Decimal("1.00")


@pytest.mark.django_db
def test_recompute_record_uses_highest_approved_penalty_only(subject, admin_user, candidate_user):
    from apps.discipline.services import (
        approve_penalty_proposal,
        create_or_update_penalty_proposal,
        recompute_disciplinary_record,
    )

    exam = _build_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user])
    session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=1)
    first_case = _create_violation_case(session=session, candidate=candidate_user, message="First case")
    second_case = _create_violation_case(session=session, candidate=candidate_user, message="Second case")

    proposal_a = create_or_update_penalty_proposal(
        violation_case=first_case,
        actor=admin_user,
        proposed_penalty_percent="10",
        notes="Minor",
    )
    proposal_b = create_or_update_penalty_proposal(
        violation_case=second_case,
        actor=admin_user,
        proposed_penalty_percent="30",
        notes="Major",
    )

    approve_penalty_proposal(proposal=proposal_a, approved_by=admin_user)
    approve_penalty_proposal(proposal=proposal_b, approved_by=admin_user)
    record = recompute_disciplinary_record(exam=exam, candidate=candidate_user, actor=admin_user)
    session.result.refresh_from_db()

    assert record.highest_approved_penalty_percent == Decimal("30.00")
    assert record.final_total_score == Decimal("0.70")
    assert session.result.penalty_percent_applied == Decimal("30.00")
    assert session.result.total_score == Decimal("0.70")


@pytest.mark.django_db
def test_recompute_exam_certificates_assigns_threshold_and_participation_awards(
    subject,
    admin_user,
    candidate_user,
    user,
):
    from apps.discipline.models import ExamCertificateAward, ExamCertificatePolicy
    from apps.discipline.services import recompute_exam_certificates

    exam = _build_exam(
        subject=subject,
        admin_user=admin_user,
        candidates=[candidate_user, user],
        question_count=5,
        passing_score=40,
        max_attempts=1,
    )
    winning_session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=5)
    losing_session = _submit_attempt(exam=exam, candidate=user, correct_count=1)
    policy = ExamCertificatePolicy.objects.create(
        exam=exam,
        mode=ExamCertificatePolicy.Mode.SCORE_THRESHOLD,
        gold_config={"threshold": 90},
        silver_config={"threshold": 75},
        bronze_config={"threshold": 60},
        encouragement_config={"threshold": 40},
        updated_by=admin_user,
    )

    awards = recompute_exam_certificates(exam=exam, triggered_by=admin_user)

    assert len(awards) == 2
    assert ExamCertificateAward.objects.get(exam=exam, candidate=candidate_user).award_level == "gold"
    assert ExamCertificateAward.objects.get(exam=exam, candidate=user).award_level == "participation"
    assert policy.mode == "score_threshold"
    assert winning_session.result.final_percentage == Decimal("100.00")
    assert losing_session.result.final_percentage == Decimal("20.00")

