from datetime import timedelta

import pytest
from django.utils import timezone


def _build_candidate_result(*, subject, admin_user, candidate_user, publish, suffix):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session
    from apps.grading.services import publish_result
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name=f"Result School {candidate_user.id}-{suffix}", code=f"RS-{candidate_user.id}-{suffix}")
    group = CandidateGroup.objects.create(name=f"Result Group {candidate_user.id}-{suffix}", school=school)
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
    exam = create_exam(
        name=f"Result Exam {candidate_user.id}-{suffix}",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        opening_at=now - timedelta(hours=1),
        closing_at=now + timedelta(hours=2),
        manual_question_ids=[question.id],
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    session_question = session.questions.first()
    save_session_answer(
        session=session,
        session_question=session_question,
        selected_option_keys=["A"],
    )
    submit_session(session=session, submitted_by=candidate_user)
    if publish:
        publish_result(result=session.result, published_by=admin_user)
    return session.result


@pytest.mark.django_db
def test_candidate_can_list_only_published_results(api_client, candidate_user, user, subject, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    _build_candidate_result(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        publish=True,
        suffix="published",
    )
    _build_candidate_result(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        publish=False,
        suffix="draft",
    )
    _build_candidate_result(
        subject=subject,
        admin_user=admin_user,
        candidate_user=user,
        publish=True,
        suffix="other-user",
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/my-results/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["candidate"]["email"] == candidate_user.email
    assert payload["results"][0]["publish_state"] == "published"
