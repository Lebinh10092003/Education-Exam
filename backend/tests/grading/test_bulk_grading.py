import pytest
from django.contrib.auth import get_user_model

from .test_services import _build_submitted_session


def _second_candidate():
    return get_user_model().objects.create_user(
        username="hs2", email="hs2@example.com", password="secret123", full_name="Học sinh 2", status="active"
    )


@pytest.mark.django_db
def test_bulk_grade_grades_valid_tasks_and_reports_invalid_ones(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.grading.models import ManualGradingTask, Result

    _, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )
    task = ManualGradingTask.objects.get(session=session)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/grading/tasks/bulk-grade/",
        {
            "grades": [
                {"task_id": task.id, "score_awarded": "0.5", "feedback": "Thiếu ví dụ"},
                {"task_id": task.id + 999, "score_awarded": 1},
            ]
        },
        format="json",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["graded_count"] == 1
    assert data["errors"][0]["task_id"] == task.id + 999
    task.refresh_from_db()
    assert task.status == "graded"
    assert task.manual_grade.feedback == "Thiếu ví dụ"
    assert Result.objects.get(session=session).workflow_status == "finalized"


@pytest.mark.django_db
def test_bulk_grade_rejects_out_of_range_score_without_affecting_others(subject, admin_user, candidate_user):
    from apps.grading.models import ManualGradingTask
    from apps.grading.services import bulk_grade_manual_tasks

    _, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )
    task = ManualGradingTask.objects.get(session=session)

    result = bulk_grade_manual_tasks(grades=[{"task_id": task.id, "score_awarded": 999}], grader=admin_user)

    assert result["graded_count"] == 0
    assert result["errors"][0]["task_id"] == task.id
    task.refresh_from_db()
    assert task.status == "pending"


@pytest.mark.django_db
def test_grade_blank_only_zeroes_empty_essays_and_progress_counts(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.exam_delivery.models import SessionAnswer
    from apps.grading.models import ManualGradingTask

    exam, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )
    task = ManualGradingTask.objects.get(session=session)
    SessionAnswer.objects.filter(session_question=task.session_question).update(answer_text="  ", is_answered=False)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    progress = api_client.get(f"/api/v1/grading/tasks/progress/?exam={exam.id}").json()["questions"]
    assert progress[0]["total"] == 1
    assert progress[0]["pending"] == 1

    response = api_client.post("/api/v1/grading/tasks/grade-blank/", {"exam_id": exam.id}, format="json")

    assert response.status_code == 200
    assert response.json()["graded_count"] == 1
    task.refresh_from_db()
    assert task.status == "graded"
    assert str(task.manual_grade.score_awarded) == "0.00"
    after = api_client.get(f"/api/v1/grading/tasks/progress/?exam={exam.id}").json()["questions"]
    assert after[0]["graded"] == 1


@pytest.mark.django_db
def test_task_list_filters_by_question(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.grading.models import ManualGradingTask

    _, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )
    task = ManualGradingTask.objects.select_related("session_question__question_revision").get(session=session)
    question_id = task.session_question.question_revision.question_id
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    hit = api_client.get(f"/api/v1/grading/tasks/?question={question_id}").json()
    miss = api_client.get(f"/api/v1/grading/tasks/?question={question_id + 999}").json()

    assert hit["count"] == 1
    assert miss["count"] == 0
