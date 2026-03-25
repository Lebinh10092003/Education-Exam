from datetime import timedelta

import pytest
from django.utils import timezone


def _build_finalized_result(*, subject, admin_user, candidate_user, score_key="A", publish=False):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session
    from apps.grading.services import publish_result
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name=f"School {candidate_user.id}", code=f"SCH{candidate_user.id}")
    group = CandidateGroup.objects.create(name=f"Candidate Group {candidate_user.id}")
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
        manual_question_ids=[objective_question.id],
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    session_question = session.questions.first()
    save_session_answer(
        session=session,
        session_question=session_question,
        selected_option_keys=[score_key],
    )
    submit_session(session=session, submitted_by=candidate_user)
    if publish:
        publish_result(result=session.result, published_by=admin_user)
    return session.result


@pytest.mark.django_db
def test_admin_can_list_results_with_candidate_and_exam_filters(api_client, admin_token, subject, admin_user, candidate_user):
    result = _build_finalized_result(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(f"/api/v1/results/?search={candidate_user.email}&exam={result.session.exam_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["candidate"]["email"] == candidate_user.email
    assert payload["results"][0]["original_score"] == payload["results"][0]["score"]
    assert payload["results"][0]["penalty_percent_applied"] == "0.00"


@pytest.mark.django_db
def test_results_summary_returns_pass_fail_and_distribution_metrics(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
    user,
):
    _build_finalized_result(subject=subject, admin_user=admin_user, candidate_user=candidate_user, score_key="A")
    _build_finalized_result(subject=subject, admin_user=admin_user, candidate_user=user, score_key="B")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get("/api/v1/results/summary/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["pass_count"] == 1
    assert payload["fail_count"] == 1
    assert len(payload["score_distribution"]) == 4


@pytest.mark.django_db
def test_admin_can_publish_finalized_result(api_client, admin_token, subject, admin_user, candidate_user):
    result = _build_finalized_result(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(f"/api/v1/results/{result.id}/publish/", format="json")

    assert response.status_code == 200
    assert response.json()["publish_state"] == "published"
