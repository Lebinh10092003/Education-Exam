from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


@pytest.mark.django_db
def test_json_import_creates_batch_and_questions(api_client, admin_token, subject):
    payload = f"""
    [
      {{
        "subject_code": "{subject.code}",
        "difficulty": "easy",
        "question_type": "multiple_choice",
        "question_text": "What is the derivative of x squared?",
        "tags": ["Calculus", "Derivatives"],
        "options": [
          {{"key": "A", "text": "2x"}},
          {{"key": "B", "text": "x"}}
        ],
        "correct_option_keys": ["A"]
      }}
    ]
    """.encode("utf-8")

    upload = SimpleUploadedFile("questions.json", payload, content_type="application/json")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(
        "/api/v1/question-imports/",
        {"source_format": "json", "file": upload},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "completed"
    assert data["success_count"] == 1
    assert data["error_count"] == 0
    assert len(data["created_question_ids"]) == 1
    assert all(isinstance(question_id, int) for question_id in data["created_question_ids"])


@pytest.mark.django_db
def test_csv_import_records_row_errors_without_crashing(api_client, admin_token, subject):
    csv_content = (
        "subject_code,difficulty,question_type,question_text,tags,option_a,option_b,correct_option_keys\n"
        f"{subject.code},easy,multiple_choice,What is the derivative of x squared?,Calculus|Derivatives,2x,x,A\n"
        "UNKNOWN,easy,multiple_choice,Invalid row,Tag,2x,x,A\n"
    ).encode("utf-8")
    upload = SimpleUploadedFile("questions.csv", csv_content, content_type="text/csv")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/question-imports/",
        {"source_format": "csv", "file": upload},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "completed"
    assert data["success_count"] == 1
    assert data["error_count"] == 1
    assert len(data["created_question_ids"]) == 1
    assert all(isinstance(question_id, int) for question_id in data["created_question_ids"])
