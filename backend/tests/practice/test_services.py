from decimal import Decimal

import pytest


def _create_objective_question(*, subject, admin_user, difficulty, question_text, correct_key="A"):
    from apps.question_bank.services import create_question

    return create_question(
        subject=subject,
        created_by=admin_user,
        difficulty=difficulty,
        question_type="multiple_choice",
        question_text=question_text,
        options=[{"key": "A", "text": "Choice A"}, {"key": "B", "text": "Choice B"}],
        correct_option_keys=[correct_key],
    )


@pytest.mark.django_db
def test_create_practice_session_snapshots_requested_objective_questions(candidate_user, subject, admin_user):
    from apps.practice.services import create_practice_session
    from apps.question_bank.services import create_question

    _create_objective_question(
        subject=subject,
        admin_user=admin_user,
        difficulty="easy",
        question_text="Easy question",
    )
    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="hard",
        question_type="true_false",
        question_text="Hard question",
        options=[{"key": "A", "text": "True"}, {"key": "B", "text": "False"}],
        correct_option_keys=["A"],
    )

    session = create_practice_session(
        candidate=candidate_user,
        subject=subject,
        duration_minutes=25,
        difficulty_counts={"easy": 1, "medium": 0, "hard": 1},
    )

    assert session.questions.count() == 2
    assert {question.question_type for question in session.questions.all()} == {"multiple_choice", "true_false"}
    assert all(question.source_question_id for question in session.questions.all())


@pytest.mark.django_db
def test_create_practice_session_rejects_when_bank_cannot_fill_request(candidate_user, subject):
    from rest_framework.exceptions import ValidationError

    from apps.practice.services import create_practice_session

    with pytest.raises(ValidationError):
        create_practice_session(
            candidate=candidate_user,
            subject=subject,
            duration_minutes=20,
            difficulty_counts={"easy": 3, "medium": 0, "hard": 0},
        )


@pytest.mark.django_db
def test_submit_practice_session_computes_correct_count_and_percentage(candidate_user, subject, admin_user):
    from apps.practice.services import create_practice_session, save_practice_answer, submit_practice_session

    _create_objective_question(
        subject=subject,
        admin_user=admin_user,
        difficulty="easy",
        question_text="What is 1 + 1?",
    )

    session = create_practice_session(
        candidate=candidate_user,
        subject=subject,
        duration_minutes=15,
        difficulty_counts={"easy": 1, "medium": 0, "hard": 0},
    )

    question = session.questions.first()
    save_practice_answer(session=session, session_question=question, selected_option_keys=["A"])
    submit_practice_session(session=session)

    session.refresh_from_db()
    question.refresh_from_db()

    assert session.status == "submitted"
    assert session.correct_count == 1
    assert session.total_count == 1
    assert session.score_percentage == Decimal("100.00")
    assert question.is_correct is True

