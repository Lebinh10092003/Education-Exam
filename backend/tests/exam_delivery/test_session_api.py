from datetime import timedelta

import pytest
from django.utils import timezone


def _build_session(*, subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import start_or_resume_session
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code=f"SCH-{candidate_user.id or 'X'}")
    group = CandidateGroup.objects.create(name=f"Candidate Group {candidate_user.id or 1}")
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
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        opening_at=now - timedelta(hours=1),
        closing_at=now + timedelta(hours=2),
        manual_question_ids=[objective_question.id, essay_question.id],
        group_ids=[group.id],
    )
    return start_or_resume_session(exam=exam, candidate=candidate_user)


@pytest.mark.django_db
def test_candidate_can_fetch_session_detail_with_questions_and_answers(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    session = _build_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get(f"/api/v1/exam-sessions/{session.id}/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == session.id
    assert payload["questions"][0]["question_text"]


@pytest.mark.django_db
def test_candidate_can_save_answer_for_session_question(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    session = _build_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    session_question = session.questions.filter(question_revision__question__question_type="multiple_choice").first()
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.put(
        f"/api/v1/exam-sessions/{session.id}/answers/{session_question.id}/",
        {"selected_option_keys": ["A"], "is_marked_for_review": True},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["selected_option_keys"] == ["A"]
    assert response.json()["is_marked_for_review"] is True


@pytest.mark.django_db
def test_candidate_can_create_autosave_snapshot(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    session = _build_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(
        f"/api/v1/exam-sessions/{session.id}/autosave/",
        {"payload": {"source": "ui-auto"}},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["answered_count"] == 0
    assert response.json()["id"] is None


@pytest.mark.django_db
def test_candidate_can_submit_session_and_receive_scoring_summary(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    session = _build_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    objective_question = session.questions.filter(question_revision__question__question_type="multiple_choice").first()
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    api_client.put(
        f"/api/v1/exam-sessions/{session.id}/answers/{objective_question.id}/",
        {"selected_option_keys": ["A"]},
        format="json",
    )

    response = api_client.post(f"/api/v1/exam-sessions/{session.id}/submit/", format="json")

    assert response.status_code == 200
    assert response.json()["status"] == "submitted"
    assert float(response.json()["objective_score"]) == 1.0
