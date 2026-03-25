from datetime import timedelta

import pytest
from django.utils import timezone


def _build_candidate_exam(*, subject, admin_user, candidate_user, assigned=True, opening_offset_hours=-1, closing_offset_hours=2):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code=f"SCH-{candidate_user.id or 'X'}")
    group = CandidateGroup.objects.create(name=f"Candidate Group {candidate_user.id or 1}")
    if assigned:
        GroupMembership.objects.create(group=group, user=candidate_user)
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
    now = timezone.now()
    return create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        opening_at=now + timedelta(hours=opening_offset_hours),
        closing_at=now + timedelta(hours=closing_offset_hours),
        manual_question_ids=[question.id],
        group_ids=[group.id],
    )


@pytest.mark.django_db
def test_candidate_can_list_assigned_exams(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    _build_candidate_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/my-exams/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["name"] == "Mathematics Final Exam"
    assert payload["results"][0]["lifecycle_phase"] == "open"


@pytest.mark.django_db
def test_candidate_exam_list_hides_assigned_class_records(api_client, candidate_user, subject, admin_user):
    from apps.exam_authoring.services import create_exam
    from rest_framework_simplejwt.tokens import RefreshToken

    _build_candidate_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    create_exam(
        name="Mathematics Learning Class",
        mode="class",
        subject=subject,
        created_by=admin_user,
        status="draft",
        duration_minutes=45,
        passing_score=0,
        max_attempts=1,
        user_ids=[candidate_user.id],
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/my-exams/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["name"] == "Mathematics Final Exam"


@pytest.mark.django_db
def test_candidate_can_start_exam_session_when_assigned_and_open(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    exam = _build_candidate_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(f"/api/v1/exams/{exam.id}/start-session/", format="json")

    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    assert response.json()["attempt_number"] == 1
    assert response.json()["lifecycle_phase"] == "open"


@pytest.mark.django_db
def test_candidate_cannot_start_exam_without_assignment(api_client, candidate_user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    exam = _build_candidate_exam(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        assigned=False,
    )
    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.post(f"/api/v1/exams/{exam.id}/start-session/", format="json")

    assert response.status_code == 403
