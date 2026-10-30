import pytest

from .test_services import _build_submitted_session


def _essay_task(subject, admin_user, candidate_user):
    from apps.grading.models import ManualGradingTask

    exam, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )
    return exam, ManualGradingTask.objects.get(session=session)


@pytest.mark.django_db
def test_essay_batch_is_anonymous_and_includes_rubric(api_client, admin_token, subject, admin_user, candidate_user):
    exam, task = _essay_task(subject, admin_user, candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    batch = api_client.get(f"/api/v1/grading/tasks/essay-batch/?exam={exam.id}").json()

    assert batch["question"]["essay_rubric"] == "State formula and explain usage."
    assert batch["answers"][0]["task_id"] == task.id
    assert batch["answers"][0]["answer_text"] == "Use the formula (a+b)^n."
    raw = str(batch)
    assert candidate_user.email not in raw
    assert (candidate_user.full_name or "@@") not in raw


@pytest.mark.django_db
def test_suggestion_is_not_an_official_grade_until_approved(api_client, admin_token, subject, admin_user, candidate_user):
    from apps.grading.models import Result

    exam, task = _essay_task(subject, admin_user, candidate_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    saved = api_client.post(
        "/api/v1/grading/tasks/suggest/",
        {"source": "claude", "suggestions": [{"task_id": task.id, "score": 0.5, "feedback": "Thiếu ví dụ",
                                              "rationale": "Nêu công thức (0.5), thiếu giải thích (0)."}]},
        format="json",
    ).json()
    assert saved["saved_count"] == 1
    task.refresh_from_db()
    assert task.status == "pending"
    assert Result.objects.get(session=task.session).workflow_status == "pending_grading"

    listed = api_client.get(f"/api/v1/grading/tasks/?exam={exam.id}").json()["results"][0]
    assert listed["suggestion"]["score"] == "0.50"
    assert listed["suggestion"]["source"] == "claude"

    approved = api_client.post(
        "/api/v1/grading/tasks/approve-suggestions/", {"task_ids": [task.id]}, format="json"
    ).json()
    assert approved["graded_count"] == 1
    task.refresh_from_db()
    assert task.status == "graded"
    assert str(task.manual_grade.score_awarded) == "0.50"
    assert task.manual_grade.feedback == "Thiếu ví dụ"
    assert Result.objects.get(session=task.session).workflow_status == "finalized"


@pytest.mark.django_db
def test_flagged_suggestions_need_explicit_approval(subject, admin_user, candidate_user):
    from apps.grading.services import approve_grade_suggestions, save_grade_suggestions

    _, task = _essay_task(subject, admin_user, candidate_user)
    save_grade_suggestions(
        suggestions=[{"task_id": task.id, "score": 1, "flags": ["prompt_injection", "made_up_flag"]}], user=admin_user
    )
    task.refresh_from_db()
    assert task.suggestion_flags == ["prompt_injection"]

    skipped = approve_grade_suggestions(task_ids=[task.id], grader=admin_user)
    assert skipped["graded_count"] == 0
    assert skipped["skipped_flagged"][0]["task_id"] == task.id

    forced = approve_grade_suggestions(task_ids=[task.id], grader=admin_user, include_flagged=True)
    assert forced["graded_count"] == 1


@pytest.mark.django_db
def test_invalid_suggestions_are_rejected(subject, admin_user, candidate_user):
    from apps.grading.services import grade_manual_task, save_grade_suggestions

    _, task = _essay_task(subject, admin_user, candidate_user)
    result = save_grade_suggestions(
        suggestions=[{"task_id": task.id, "score": 99}, {"task_id": 999999, "score": 1}], user=admin_user
    )
    assert result["saved_count"] == 0
    assert len(result["errors"]) == 2

    grade_manual_task(task=task, grader=admin_user, score_awarded=1)
    after_grade = save_grade_suggestions(suggestions=[{"task_id": task.id, "score": 0.5}], user=admin_user)
    assert "chính thức" in after_grade["errors"][0]["error"]


@pytest.mark.django_db
def test_batch_skips_already_suggested_answers(subject, admin_user, candidate_user):
    from apps.grading.services import build_essay_grading_batch, save_grade_suggestions

    exam, task = _essay_task(subject, admin_user, candidate_user)
    save_grade_suggestions(suggestions=[{"task_id": task.id, "score": 1}], user=admin_user)

    assert build_essay_grading_batch(exam_id=exam.id)["answers"] == []
    assert build_essay_grading_batch(exam_id=exam.id, include_suggested=True)["answers"][0]["current_suggestion"]
