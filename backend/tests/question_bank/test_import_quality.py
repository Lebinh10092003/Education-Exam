import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


def _upload(rows):
    return SimpleUploadedFile("questions.json", json.dumps(rows, ensure_ascii=False).encode("utf-8"),
                              content_type="application/json")


def _mc(subject, text, **overrides):
    row = {
        "subject_code": subject.code,
        "difficulty": "easy",
        "question_type": "multiple_choice",
        "question_text": text,
        "options": [{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        "correct_option_keys": ["A"],
    }
    row.update(overrides)
    return row


@pytest.mark.django_db
def test_dry_run_reports_problems_without_creating_questions(api_client, admin_token, subject):
    from apps.question_bank.models import Question

    rows = [
        _mc(subject, "Đạo hàm của x^2?", difficulty="Dễ", question_type="Trắc nghiệm"),
        _mc(subject, "Câu nhiều đáp án", correct_option_keys=["A", "B"]),
        _mc(subject, "Đáp án sai ký hiệu", correct_option_keys=["C"]),
        _mc(subject, "Độ khó lạ", difficulty="siêu khó"),
        _mc(subject, ""),
        {"subject_code": "KHONG_CO", "question_type": "essay", "difficulty": "easy", "question_text": "x"},
        {"subject_code": subject.code, "question_type": "essay", "difficulty": "hard", "question_text": "Giải thích."},
        _mc(subject, "đạo hàm của  X^2 ?"),
    ]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/question-imports/", {"source_format": "json", "file": _upload(rows), "dry_run": True}
    )

    assert response.status_code == 200
    report = response.json()
    assert report["dry_run"] is True
    assert report["total_rows"] == 8
    codes = {item["row"]: {issue["code"] for issue in item["issues"]} for item in report["rows"]}
    statuses = {item["row"]: item["status"] for item in report["rows"]}
    assert statuses[1] == "ok"  # alias tieng Viet duoc chuan hoa
    assert report["rows"][0]["difficulty"] == "easy"
    assert "multiple_answers" in codes[2]
    assert "answer_not_in_options" in codes[3]
    assert "invalid_difficulty" in codes[4]
    assert "empty_text" in codes[5]
    assert "invalid_row" in codes[6]
    assert statuses[7] == "warning" and "missing_rubric" in codes[7]
    assert "duplicate_in_file" in codes[8]
    assert report["error_rows"] == 5
    assert Question.objects.count() == 0


@pytest.mark.django_db
def test_real_import_rejects_invalid_rows_and_can_skip_bank_duplicates(api_client, admin_token, subject, admin_user):
    from apps.question_bank.models import Question
    from apps.question_bank.services import create_question

    existing = create_question(
        subject=subject, created_by=admin_user, difficulty="easy", question_type="multiple_choice",
        question_text="Thủ đô của Việt Nam?", options=[{"key": "A", "text": "Hà Nội"}, {"key": "B", "text": "Huế"}],
        correct_option_keys=["A"],
    )
    rows = [
        _mc(subject, "Câu hợp lệ mới"),
        _mc(subject, "Độ khó lạ", difficulty="??"),
        _mc(subject, "thủ đô của việt nam"),
    ]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/question-imports/",
        {"source_format": "json", "file": _upload(rows), "skip_duplicates": True},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success_count"] == 1
    assert data["error_count"] == 2
    messages = " ".join(error["message"] for error in data["errors"])
    assert "Độ khó" in messages
    assert f"#{existing.id}" in messages
    assert Question.objects.count() == 2


@pytest.mark.django_db
def test_broken_file_returns_400_instead_of_server_error(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    broken = SimpleUploadedFile("q.json", b"{not json", content_type="application/json")

    response = api_client.post("/api/v1/question-imports/", {"source_format": "json", "file": broken})

    assert response.status_code == 400
