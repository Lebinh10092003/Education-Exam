import pytest


@pytest.mark.django_db
def test_admin_can_create_exam_with_manual_questions_random_rules_and_groups(
    api_client,
    admin_token,
    admin_user,
    subject,
):
    from apps.institutions.models import CandidateGroup, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1", school=school)
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
    create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="medium",
        question_type="essay",
        question_text="Explain the binomial theorem.",
        tags=["Algebra"],
        essay_rubric="State formula and explain usage.",
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(
        "/api/v1/exams/",
        {
            "name": "Mathematics Final Exam",
            "subject_id": subject.id,
            "description": "Semester final",
            "status": "scheduled",
            "duration_minutes": 120,
            "passing_score": 60,
            "max_attempts": 1,
            "shuffle_questions": True,
            "show_results_immediately": False,
            "enable_proctoring": True,
            "opening_at": "2026-03-22T08:00:00+07:00",
            "closing_at": "2026-03-22T12:00:00+07:00",
            "manual_question_ids": [question.id],
            "random_rules": [{"difficulty": "medium", "count": 1}],
            "group_ids": [group.id],
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "scheduled"
    assert payload["current_version"]["version_number"] == 1
    assert payload["current_version"]["item_count"] == 2
    assert payload["assignment_summary"]["group_count"] == 1


@pytest.mark.django_db
def test_exam_list_supports_search_and_status_filters(api_client, admin_token, admin_user, subject):
    from apps.academics.models import Subject
    from apps.exam_authoring.services import create_exam

    physics = Subject.objects.create(
        name="Physics",
        code="PHYS101",
        description="Fundamental physics",
        color="bg-purple-600",
    )
    create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status="draft",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
    )
    create_exam(
        name="Physics Mid-term Assessment",
        subject=physics,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=90,
        passing_score=50,
        max_attempts=1,
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/exams/?search=math&status=draft")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["subject"]["code"] == "MATH101"


@pytest.mark.django_db
def test_exam_update_creates_new_version(api_client, admin_token, admin_user, subject):
    from apps.exam_authoring.services import create_exam
    from apps.question_bank.services import create_question

    first_question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        correct_option_keys=["A"],
    )
    second_question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="medium",
        question_type="essay",
        question_text="Explain the binomial theorem.",
        tags=["Algebra"],
        essay_rubric="State formula and explain usage.",
    )
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        manual_question_ids=[first_question.id],
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.patch(
        f"/api/v1/exams/{exam.id}/",
        {
            "manual_question_ids": [first_question.id, second_question.id],
            "description": "Updated version",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["current_version"]["version_number"] == 2
    assert response.json()["current_version"]["item_count"] == 2


@pytest.mark.django_db
def test_clone_endpoint_creates_new_exam_copy(api_client, admin_token, admin_user, subject):
    from apps.exam_authoring.services import create_exam
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
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        manual_question_ids=[question.id],
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/exams/{exam.id}/clone/", format="json")

    assert response.status_code == 201
    assert response.json()["current_version"]["version_number"] == 1
    assert response.json()["id"] != exam.id

