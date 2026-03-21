import pytest


@pytest.mark.django_db
def test_admin_can_create_multiple_choice_question(api_client, admin_token, subject):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/questions/",
        {
            "subject_id": subject.id,
            "difficulty": "easy",
            "question_type": "multiple_choice",
            "question_text": "What is the derivative of x squared?",
            "tags": ["Calculus", "Derivatives"],
            "options": [
                {"key": "A", "text": "2x"},
                {"key": "B", "text": "x"},
                {"key": "C", "text": "x squared"},
                {"key": "D", "text": "2"},
            ],
            "correct_option_keys": ["A"],
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["difficulty"] == "easy"
    assert payload["current_revision"]["revision_number"] == 1
    assert payload["current_revision"]["answer_key"]["correct_option_keys"] == ["A"]


@pytest.mark.django_db
def test_question_list_supports_search_subject_and_difficulty_filters(
    api_client,
    admin_token,
    subject,
    admin_user,
):
    from apps.academics.models import Subject
    from apps.question_bank.services import create_question

    physics = Subject.objects.create(
        name="Physics",
        code="PHYS101",
        description="Fundamental physics",
        color="bg-purple-600",
    )
    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        correct_option_keys=["A"],
    )
    create_question(
        subject=physics,
        created_by=admin_user,
        difficulty="hard",
        question_type="essay",
        question_text="Explain Newton's First Law.",
        tags=["Mechanics"],
        essay_rubric="State inertia and balanced forces.",
        sample_answer="An object remains at rest or in uniform motion...",
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get(
        f"/api/v1/questions/?search=derivative&subject={subject.id}&difficulty=easy"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["subject"]["code"] == "MATH101"


@pytest.mark.django_db
def test_question_update_creates_new_revision(api_client, admin_token, subject, admin_user):
    from apps.question_bank.services import create_question

    question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        correct_option_keys=["A"],
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.patch(
        f"/api/v1/questions/{question.id}/",
        {
            "difficulty": "medium",
            "question_text": "What is the derivative of x^2?",
            "tags": ["Calculus", "Derivatives"],
            "options": [
                {"key": "A", "text": "2x"},
                {"key": "B", "text": "x"},
                {"key": "C", "text": "2"},
            ],
            "correct_option_keys": ["A"],
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["current_revision"]["revision_number"] == 2
