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


def _assign_subject_access(*, subject, admin_user, user, mode="class"):
    from apps.exam_authoring.services import create_exam

    create_exam(
        name=f"{subject.name} {mode.title()} Access",
        mode=mode,
        subject=subject,
        created_by=admin_user,
        status="draft" if mode == "class" else "scheduled",
        duration_minutes=45,
        passing_score=0,
        max_attempts=1,
        user_ids=[user.id],
    )


@pytest.mark.django_db
def test_candidate_can_fetch_practice_catalog(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    _assign_subject_access(subject=subject, admin_user=admin_user, user=candidate_user)
    _create_objective_question(
        subject=subject,
        admin_user=admin_user,
        difficulty="easy",
        question_text="Catalog question",
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/practice/catalog/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"][0]["subject"]["code"] == subject.code
    assert payload["results"][0]["counts"]["easy"] == 1


@pytest.mark.django_db
def test_candidate_can_create_answer_submit_and_review_practice_session(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    _assign_subject_access(subject=subject, admin_user=admin_user, user=candidate_user)
    _create_objective_question(
        subject=subject,
        admin_user=admin_user,
        difficulty="easy",
        question_text="Practice lifecycle question",
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    create_response = api_client.post(
        "/api/v1/practice/sessions/",
        {"subject_id": subject.id},
        format="json",
    )

    assert create_response.status_code == 201
    session_id = create_response.json()["id"]
    question_id = create_response.json()["questions"][0]["id"]

    answer_response = api_client.put(
        f"/api/v1/practice/sessions/{session_id}/answers/{question_id}/",
        {"selected_option_keys": ["A"]},
        format="json",
    )
    assert answer_response.status_code == 200

    submit_response = api_client.post(f"/api/v1/practice/sessions/{session_id}/submit/", format="json")
    assert submit_response.status_code == 200
    assert submit_response.json()["status"] == "submitted"

    review_response = api_client.get(f"/api/v1/practice/sessions/{session_id}/review/")
    assert review_response.status_code == 200
    assert review_response.json()["summary"]["correct_count"] == 1
    assert review_response.json()["details_available"] is True
    assert "questions" not in review_response.json()


@pytest.mark.django_db
def test_candidate_cannot_access_other_users_practice_session(api_client, candidate_user, user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    from apps.practice.services import create_practice_session

    _create_objective_question(
        subject=subject,
        admin_user=admin_user,
        difficulty="easy",
        question_text="Owned question",
    )

    practice_session = create_practice_session(
        candidate=candidate_user,
        subject=subject,
    )

    token = str(RefreshToken.for_user(user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get(f"/api/v1/practice/sessions/{practice_session.id}/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_candidate_reuses_in_progress_practice_session_for_same_subject(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    _assign_subject_access(subject=subject, admin_user=admin_user, user=candidate_user)
    _create_objective_question(
        subject=subject,
        admin_user=admin_user,
        difficulty="easy",
        question_text="Reusable question",
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    first = api_client.post("/api/v1/practice/sessions/", {"subject_id": subject.id}, format="json")
    second = api_client.post("/api/v1/practice/sessions/", {"subject_id": subject.id}, format="json")

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
