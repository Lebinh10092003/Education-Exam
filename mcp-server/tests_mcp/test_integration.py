"""Chay cac tool MCP qua REST API that cua backend (Django + CSDL test)."""

import json
from datetime import timedelta

import pytest
from django.utils import timezone

from eduexam_mcp import server


def _mc(subject, text, **overrides):
    row = {
        "subject_code": subject.code,
        "difficulty": "easy",
        "question_type": "multiple_choice",
        "question_text": text,
        "options": [{"key": "A", "text": "Đúng"}, {"key": "B", "text": "Sai"}],
        "correct_option_keys": ["A"],
    }
    row.update(overrides)
    return row


@pytest.mark.django_db
def test_whoami_logs_in_with_configured_account(mcp_client, admin_user):
    profile = server.whoami()
    assert profile["email"] == admin_user.email


@pytest.mark.django_db
def test_validate_questions_reports_errors_without_writing(mcp_client, subject):
    from apps.question_bank.models import Question

    report = server.validate_questions([
        _mc(subject, "Câu tốt"),
        _mc(subject, "Câu hai đáp án", correct_option_keys=["A", "B"]),
    ])

    assert report["total_rows"] == 2
    assert report["error_rows"] == 1
    assert report["problem_rows"][0]["row"] == 2
    assert Question.objects.count() == 0


@pytest.mark.django_db
def test_import_stops_when_file_has_errors_unless_partial_allowed(mcp_client, subject, tmp_path):
    from apps.question_bank.models import Question

    file_path = tmp_path / "de-kiem-tra.json"
    file_path.write_text(
        json.dumps([_mc(subject, "Câu 1"), _mc(subject, "Câu lỗi", difficulty="???")], ensure_ascii=False),
        encoding="utf-8",
    )

    blocked = server.import_question_file(str(file_path))
    assert blocked["imported"] is False
    assert Question.objects.count() == 0

    partial = server.import_question_file(str(file_path), allow_partial=True)
    assert partial["imported"] is True
    assert partial["success_count"] == 1
    assert partial["error_count"] == 1
    assert Question.objects.count() == 1


@pytest.mark.django_db
def test_csv_import_with_vietnamese_aliases(mcp_client, subject, tmp_path):
    file_path = tmp_path / "cau-hoi.csv"
    file_path.write_text(
        "subject_code,question_type,difficulty,question_text,option_a,option_b,correct_option_keys\n"
        f"{subject.code},Trắc nghiệm,Dễ,1 + 1 = ?,2,3,A\n",
        encoding="utf-8",
    )

    result = server.import_question_file(str(file_path))

    assert result["imported"] is True
    assert result["success_count"] == 1
    question = server.get_question(result["created_question_ids"][0])
    assert question["difficulty"] == "easy"
    assert question["question_type"] == "multiple_choice"


@pytest.mark.django_db
def test_create_exam_then_check_and_scan_upcoming(mcp_client, subject):
    imported = server.import_questions([_mc(subject, f"Câu {index}") for index in range(3)])
    now = timezone.now()

    created = server.create_exam(
        name="Kiểm tra 15 phút",
        subject_id=subject.id,
        duration_minutes=15,
        opening_at=(now + timedelta(days=1)).isoformat(),
        closing_at=(now + timedelta(days=1, minutes=10)).isoformat(),
        manual_question_ids=imported["created_question_ids"],
        status="scheduled",
    )

    codes = {issue["code"] for issue in created["quality_check"]["issues"]}
    assert created["quality_check"]["stats"]["question_count"] == 3
    assert "window_shorter_than_duration" in codes
    assert "no_candidates" in codes

    scan = server.check_upcoming_exams()
    assert scan["checked"] >= 1
    assert any(item["exam_id"] == created["exam_id"] for item in scan["exams"])


@pytest.mark.django_db
def test_grading_tools_bulk_grade_and_blank_zero(mcp_client, subject, admin_user, candidate_user):
    from apps.exam_delivery.models import SessionAnswer
    from apps.grading.models import ManualGradingTask
    from tests.grading.test_services import _build_submitted_session

    exam, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )
    progress = server.grading_progress(exam.id)
    assert progress["questions"][0]["pending"] == 1

    tasks = server.list_grading_tasks(exam.id)
    task_id = tasks["results"][0]["id"]
    result = server.bulk_grade([{"task_id": task_id, "score_awarded": 0.75, "feedback": "Khá"}])
    assert result["graded_count"] == 1
    assert ManualGradingTask.objects.get(id=task_id).status == "graded"

    # Bai bo trong cua lan khac: dat lai ve chua cham + bo trong roi cho 0 diem hang loat.
    ManualGradingTask.objects.filter(id=task_id).update(status="pending")
    SessionAnswer.objects.filter(session_question__session=session, session_question__question_revision__question__question_type="essay").update(answer_text="")
    blank = server.grade_blank_answers(exam.id)
    assert blank["graded_count"] == 1


@pytest.mark.django_db
def test_api_errors_are_readable(mcp_client):
    with pytest.raises(ValueError, match="404"):
        server.check_exam(999999)


@pytest.mark.django_db
def test_ai_essay_grading_flow_requires_teacher_approval(mcp_client, subject, admin_user, candidate_user):
    from apps.grading.models import ManualGradingTask
    from tests.grading.test_services import _build_submitted_session

    exam, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )

    batch = server.get_essay_grading_batch(exam.id)
    assert batch["question"]["essay_rubric"]
    assert candidate_user.email not in json.dumps(batch)
    task_id = batch["answers"][0]["task_id"]

    saved = server.suggest_essay_grades(
        [{"task_id": task_id, "score": 0.75, "feedback": "Đúng công thức", "rationale": "Ý1 0.75/1"}]
    )
    assert saved["saved_count"] == 1
    assert ManualGradingTask.objects.get(id=task_id).status == "pending"
    assert server.get_essay_grading_batch(exam.id)["remaining"] == 0

    approved = server.approve_essay_suggestions([task_id])
    assert approved["graded_count"] == 1
    assert ManualGradingTask.objects.get(id=task_id).status == "graded"


def test_grading_prompt_warns_about_injection():
    text = server.essay_grading_prompt("12")
    assert "prompt_injection" in text
    assert "de 12" in text
