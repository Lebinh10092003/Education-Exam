from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook


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
    from apps.question_bank.models import Question

    question = Question.objects.get(pk=data["created_question_ids"][0])
    assert question.current_revision.question_text == "What is the derivative of x squared?"


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


@pytest.mark.django_db
def test_csv_import_preserves_unicode_math_symbols(api_client, admin_token, subject):
    csv_content = (
        "subject_code,difficulty,question_type,question_text,tags,option_a,option_b,correct_option_keys\n"
        f'{subject.code},easy,multiple_choice,"Tính √(x²) ≤ 3 và π > 3?",Math,"Đúng","Sai",A\n'
    ).encode("utf-8-sig")
    upload = SimpleUploadedFile("questions.csv", csv_content, content_type="text/csv")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/question-imports/",
        {"source_format": "csv", "file": upload},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success_count"] == 1
    from apps.question_bank.models import Question

    question = Question.objects.get(pk=data["created_question_ids"][0])
    assert question.current_revision.question_text == "Tính √(x²) ≤ 3 và π > 3?"
    assert question.current_revision.options.get(key="A").text == "Đúng"


@pytest.mark.django_db
def test_json_import_preserves_latex_text(api_client, admin_token, subject):
    payload = f"""
    [
      {{
        "subject_code": "{subject.code}",
        "difficulty": "medium",
        "question_type": "multiple_choice",
        "question_text": "Giá trị của $\\\\frac{{1}}{{2}} + x^2$ là gì?",
        "options": [
          {{"key": "A", "text": "$x^2 + 0.5$"}},
          {{"key": "B", "text": "$x$"}}
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
    assert data["success_count"] == 1
    from apps.question_bank.models import Question

    question = Question.objects.get(pk=data["created_question_ids"][0])
    assert question.current_revision.question_text == "Giá trị của $\\frac{1}{2} + x^2$ là gì?"
    assert question.current_revision.options.get(key="A").text == "$x^2 + 0.5$"


@pytest.mark.django_db
def test_xlsx_import_creates_questions_and_preserves_math(api_client, admin_token, subject):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append([
        "subject_code",
        "difficulty",
        "question_type",
        "question_text",
        "tags",
        "option_a",
        "option_b",
        "correct_option_keys",
    ])
    worksheet.append([
        subject.code,
        "easy",
        "multiple_choice",
        "Tìm x để x² ≥ 4",
        "Đại số",
        "x ≥ 2 hoặc x ≤ -2",
        "-2 < x < 2",
        "A",
    ])
    stream = BytesIO()
    workbook.save(stream)
    stream.seek(0)
    upload = SimpleUploadedFile(
        "questions.xlsx",
        stream.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/question-imports/",
        {"source_format": "xlsx", "file": upload},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success_count"] == 1
    assert data["error_count"] == 0
    from apps.question_bank.models import Question

    question = Question.objects.get(pk=data["created_question_ids"][0])
    assert question.current_revision.question_text == "Tìm x để x² ≥ 4"
    assert question.current_revision.options.get(key="A").text == "x ≥ 2 hoặc x ≤ -2"
