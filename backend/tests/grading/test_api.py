from datetime import timedelta

import pytest
from django.utils import timezone


def _build_manual_grading_task(*, subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name=f"School {candidate_user.id}", code=f"SCH{candidate_user.id}")
    group = CandidateGroup.objects.create(name=f"Candidate Group {candidate_user.id}")
    GroupMembership.objects.create(group=group, user=candidate_user)
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
        manual_question_ids=[essay_question.id],
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    session_question = session.questions.first()
    save_session_answer(
        session=session,
        session_question=session_question,
        answer_text="Use the formula (a+b)^n.",
    )
    submit_session(session=session, submitted_by=candidate_user)
    return session.manual_grading_tasks.first()


@pytest.mark.django_db
def test_admin_can_list_manual_grading_tasks(api_client, admin_token, subject, admin_user, candidate_user):
    _build_manual_grading_task(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get("/api/v1/grading/tasks/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["candidate"]["email"] == candidate_user.email


@pytest.mark.django_db
def test_admin_can_grade_manual_task(api_client, admin_token, subject, admin_user, candidate_user):
    task = _build_manual_grading_task(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        f"/api/v1/grading/tasks/{task.id}/grade/",
        {"score_awarded": "1.00", "feedback": "Well structured answer."},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "graded"
    assert response.json()["manual_grade"]["score_awarded"] == "1.00"


@pytest.mark.django_db
def test_grading_task_list_supports_status_and_exam_filters(api_client, admin_token, subject, admin_user, candidate_user):
    task = _build_manual_grading_task(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(f"/api/v1/grading/tasks/?status=pending&exam={task.session.exam_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["status"] == "pending"


@pytest.mark.django_db
def test_submission_does_not_create_notification_for_manual_grading_queue(subject, admin_user, candidate_user):
    from apps.notifications.models import Notification

    task = _build_manual_grading_task(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    notification = Notification.objects.filter(
        recipient=admin_user,
        category=Notification.Category.GRADING,
        metadata__session_id=task.session_id,
    ).first()

    assert notification is None
