from io import BytesIO

import pytest
from openpyxl import load_workbook

from .test_services import _build_exam, _create_violation_case, _submit_attempt


@pytest.mark.django_db
def test_admin_can_list_discipline_exam_summaries(api_client, admin_token, subject, admin_user, candidate_user):
    exam = _build_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user], max_attempts=1)
    session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=1)
    _create_violation_case(session=session, candidate=candidate_user)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/discipline/exams/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["id"] == exam.id
    assert payload["results"][0]["unique_violating_candidates"] == 1
    assert payload["results"][0]["total_cases"] == 1


@pytest.mark.django_db
def test_admin_can_approve_penalty_via_api_with_inline_percent(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    exam = _build_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user], max_attempts=1)
    session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=1)
    case = _create_violation_case(session=session, candidate=candidate_user)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    approve_response = api_client.post(
        f"/api/v1/discipline/cases/{case.id}/approve/",
        {"proposed_penalty_percent": "25", "notes": "Penalty note"},
        format="json",
    )
    assert approve_response.status_code == 200

    record_response = api_client.get(f"/api/v1/discipline/exams/{exam.id}/records/")
    assert record_response.status_code == 200
    payload = record_response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["applied_penalty_percent"] == "25.00"
    assert payload["results"][0]["final_total_score"] == "0.75"


@pytest.mark.django_db
def test_admin_can_bulk_approve_penalties_without_existing_proposals(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    exam = _build_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user], max_attempts=1)
    session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=1)
    case = _create_violation_case(session=session, candidate=candidate_user)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        f"/api/v1/discipline/exams/{exam.id}/bulk-apply/",
        {
            "action": "approve",
            "case_ids": [case.id],
            "proposed_penalty_percent": "40",
        },
        format="json",
    )

    assert response.status_code == 200

    record_response = api_client.get(f"/api/v1/discipline/exams/{exam.id}/records/")
    assert record_response.status_code == 200
    payload = record_response.json()
    assert payload["results"][0]["applied_penalty_percent"] == "40.00"
    assert payload["results"][0]["final_total_score"] == "0.60"


@pytest.mark.django_db
def test_admin_can_export_exam_disciplinary_summary_to_excel(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    from apps.discipline.services import approve_penalty_proposal, create_or_update_penalty_proposal

    exam = _build_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user], max_attempts=1)
    session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=1)
    case = _create_violation_case(session=session, candidate=candidate_user)
    proposal = create_or_update_penalty_proposal(
        violation_case=case,
        actor=admin_user,
        proposed_penalty_percent="10",
        notes="Export test",
    )
    approve_penalty_proposal(proposal=proposal, approved_by=admin_user)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get(f"/api/v1/discipline/exams/{exam.id}/export/")

    assert response.status_code == 200
    workbook = load_workbook(BytesIO(response.content))
    sheet = workbook.active
    assert sheet.title == "Tổng hợp kỷ luật"
    assert sheet["A2"].value == exam.name


@pytest.mark.django_db
def test_case_api_localizes_existing_case_title_and_summary_for_vietnamese_locale(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    exam = _build_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user], max_attempts=1)
    session = _submit_attempt(exam=exam, candidate=candidate_user, correct_count=1)
    _create_violation_case(
        session=session,
        candidate=candidate_user,
        message="Candidate exited fullscreen during a protected exam.",
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}", HTTP_ACCEPT_LANGUAGE="vi")
    response = api_client.get(f"/api/v1/discipline/exams/{exam.id}/cases/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"][0]["title"] == "Thoát toàn màn hình"
    assert payload["results"][0]["summary"] == "Thí sinh đã thoát chế độ toàn màn hình trong một kỳ thi được bảo vệ."
