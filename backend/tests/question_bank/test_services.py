import pytest


@pytest.mark.django_db
def test_create_question_builds_revision_options_and_answer_key(subject, admin_user):
    from apps.question_bank.services import create_question

    question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus", "Derivatives"],
        options=[
            {"key": "A", "text": "2x"},
            {"key": "B", "text": "x"},
            {"key": "C", "text": "x squared"},
            {"key": "D", "text": "2"},
        ],
        correct_option_keys=["A"],
    )

    assert question.current_revision.revision_number == 1
    assert question.current_revision.options.count() == 4
    assert question.current_revision.answer_key.correct_option_keys == ["A"]
    assert question.tags.count() == 2


@pytest.mark.django_db
def test_update_question_creates_revision_without_mutating_old_revision(subject, admin_user):
    from apps.question_bank.services import create_question, revise_question

    question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[
            {"key": "A", "text": "2x"},
            {"key": "B", "text": "x"},
        ],
        correct_option_keys=["A"],
    )
    old_revision = question.current_revision

    updated = revise_question(
        question=question,
        updated_by=admin_user,
        difficulty="medium",
        question_type="multiple_choice",
        question_text="What is the derivative of x^2?",
        tags=["Calculus", "Derivatives"],
        options=[
            {"key": "A", "text": "2x"},
            {"key": "B", "text": "x"},
            {"key": "C", "text": "2"},
        ],
        correct_option_keys=["A"],
    )

    assert updated.current_revision.revision_number == 2
    assert updated.current_revision_id != old_revision.id
    assert old_revision.question_text == "What is the derivative of x squared?"
    assert updated.current_revision.options.count() == 3
