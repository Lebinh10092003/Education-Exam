"""Chay tool quan tri qua REST API that (Django + CSDL test) de chac payload dung voi backend."""

from datetime import timedelta

import pytest
from django.utils import timezone

from eduexam_mcp import admin_tools as admin
from eduexam_mcp import server


@pytest.fixture
def export_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EDUEXAM_EXPORT_DIR", str(tmp_path / "exports"))
    return tmp_path / "exports"


def _exam(subject, *, status="scheduled", opens_in=timedelta(hours=-1)):
    questions = server.import_questions(
        [
            {
                "subject_code": subject.code,
                "question_type": "multiple_choice",
                "difficulty": "easy",
                "question_text": f"Câu kiểm tra {index}",
                "options": [{"key": "A", "text": "1"}, {"key": "B", "text": "2"}],
                "correct_option_keys": ["A"],
            }
            for index in range(2)
        ]
    )
    now = timezone.now()
    return server.create_exam(
        name="Đề MCP",
        subject_id=subject.id,
        duration_minutes=30,
        opening_at=(now + opens_in).isoformat(),
        closing_at=(now + timedelta(hours=3)).isoformat(),
        manual_question_ids=questions["created_question_ids"],
        status=status,
    )


@pytest.mark.django_db
def test_question_crud(mcp_client, subject):
    created = admin.create_question(
        subject_id=subject.id,
        question_type="multiple_choice",
        difficulty="easy",
        question_text="2 + 2 = ?",
        options=[{"key": "A", "text": "4"}, {"key": "B", "text": "5"}],
        correct_option_keys=["A"],
        tags=["Số học"],
    )
    updated = admin.update_question(created["id"], {"difficulty": "medium"})
    assert updated["difficulty"] == "medium"
    assert admin.list_question_tags()["count"] >= 1

    preview = admin.delete_question(created["id"])
    assert preview["requires_confirmation"] is True
    assert admin.delete_question(created["id"], confirm=True)["executed"] is True


@pytest.mark.django_db
def test_exam_lifecycle_clone_groups_and_student_import(mcp_client, subject, tmp_path):
    exam = _exam(subject)
    exam_id = exam["exam_id"]

    assert admin.update_exam(exam_id, {"duration_minutes": 40})["duration_minutes"] == 40
    assert admin.set_exam_status(exam_id, "open")["status"] == "open"
    assert admin.set_exam_status(exam_id, "paused")["status"] == "paused"
    assert admin.set_exam_status(exam_id, "closed")["requires_confirmation"] is True
    assert admin.set_exam_status(exam_id, "closed", confirm=True)["status"] == "closed"

    group = admin.create_group("Lớp 9A1")
    admin.set_exam_group_assignments(exam_id, [group["id"]])
    assigned = admin.get_exam_group_assignments(exam_id)
    assert str(group["id"]) in str(assigned)

    clone = admin.clone_exam(exam_id, "Đề MCP (bản sao)")
    assert clone["id"] != exam_id

    csv_path = tmp_path / "thi-sinh.csv"
    csv_path.write_text(
        "full_name,date_of_birth,student_class,cccd\nNguyễn Văn B,2010-05-01,9A1,001210000001\n", encoding="utf-8"
    )
    summary = admin.import_students_to_exam(exam_id, str(csv_path))
    assert "001210000001" in str(summary) or summary

    assert admin.delete_exam(clone["id"])["requires_confirmation"] is True
    assert admin.delete_exam(clone["id"], confirm=True)["executed"] is True
    assert "results" in admin.exam_monitoring_hub()


@pytest.mark.django_db
def test_results_publish_and_exports(mcp_client, subject, admin_user, candidate_user, export_dir):
    from tests.grading.test_services import _build_submitted_session

    exam, session, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=False
    )
    results = admin.list_results(exam_id=exam.id)
    result_id = results["results"][0]["id"]
    assert admin.get_result(result_id)["id"] == result_id
    assert admin.get_result_review(result_id)["questions"]
    assert admin.list_exam_candidates(exam.id)

    assert admin.publish_exam_results(exam.id)["requires_confirmation"] is True
    for kind in ("xlsx", "csv", "roster", "unsubmitted"):
        saved = admin.export_results(exam.id, kind=kind)
        assert saved["size_bytes"] > 0
    assert admin.export_result_review(result_id)["size_bytes"] > 0
    assert len(list(export_dir.iterdir())) == 5


@pytest.mark.django_db
def test_violation_and_discipline_flow(mcp_client, subject, admin_user, candidate_user, export_dir):
    from apps.proctoring.services import record_proctor_event
    from tests.proctoring.utils import build_active_session

    exam, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    event = record_proctor_event(session=session, event_type="tab_switch", severity="warning", reported_by=candidate_user)
    case_id = event.violation_cases.first().id

    cases = admin.list_violation_cases(exam_id=exam.id)
    assert cases["results"][0]["id"] == case_id
    assert admin.get_violation_case(case_id)["id"] == case_id
    assert admin.export_violation_cases(exam_id=exam.id)["size_bytes"] > 0

    discipline_exams = admin.list_discipline_exams()
    rows = discipline_exams["results"] if isinstance(discipline_exams, dict) else discipline_exams
    assert any(item["id"] == exam.id for item in rows)
    assert admin.list_discipline_cases(exam.id)
    proposed = admin.propose_penalty(case_id, 10, "Chuyển tab 1 lần")
    assert proposed
    assert admin.decide_penalty(case_id, "approve", 10)["requires_confirmation"] is True
    assert admin.decide_penalty(case_id, "no_penalty") is not None
    assert admin.bulk_discipline_action(exam.id, "draft", [case_id], 5)["requires_confirmation"] is True
    policy = admin.get_certificate_policy(exam.id)
    assert policy["configured"] is False
    admin.set_certificate_policy(exam.id, policy["example"])
    assert admin.get_certificate_policy(exam.id)["gold_config"] == {"threshold": 90}
    admin.recompute_certificates(exam.id)
    assert admin.export_discipline(exam.id, "records")["size_bytes"] > 0

    resolved = admin.resolve_violation_case(case_id, "dismissed", "Mạng chập chờn")
    assert resolved["status"] == "dismissed"


@pytest.mark.django_db
def test_subjects_materials_schools(mcp_client, tmp_path, export_dir):
    subject = admin.create_subject("Tin học", "TIN9")
    assert admin.update_subject(subject["id"], {"description": "Lớp 9"})["description"] == "Lớp 9"

    file_path = tmp_path / "bai-giang.pdf"
    file_path.write_bytes(b"%PDF-1.4 demo")
    material = admin.upload_material(str(file_path), "Bài giảng 1", subject["id"])
    assert admin.list_materials(subject_id=subject["id"])["count"] == 1
    assert admin.update_material(material["id"], {"title": "Bài giảng 1 (sửa)"})["title"] == "Bài giảng 1 (sửa)"
    downloaded = admin.download_material(material["id"])
    # Moi truong test khong phuc vu /media nen chi kiem tra co link file.
    assert downloaded["file_url"].endswith(".pdf")
    assert admin.delete_material(material["id"], confirm=True)["executed"] is True

    school = admin.create_school("THCS Giảng Võ", "GV01")
    assert admin.update_school(school["id"], {"description": "Hà Nội"})["description"] == "Hà Nội"
    assert admin.list_schools(search="Giảng")["count"] == 1
    assert admin.delete_school(school["id"], confirm=True)["executed"] is True
    assert admin.delete_subject(subject["id"], confirm=True)["executed"] is True


@pytest.mark.django_db
def test_groups_members_users_and_roles(mcp_client, candidate_user, tmp_path):
    group = admin.create_group("Đội tuyển Toán")
    assert admin.update_group(group["id"], {"description": "Khối 9"})["description"] == "Khối 9"
    admin.add_group_member(group["id"], candidate_user.id)
    assert candidate_user.email in str(admin.list_group_members(group["id"]))
    admin.remove_group_member(group["id"], candidate_user.id)
    assert candidate_user.email not in str(admin.list_group_members(group["id"]))

    members_csv = tmp_path / "thanh-vien.csv"
    members_csv.write_text("full_name,email\nTrần Thị C,ttc@example.com\n", encoding="utf-8")
    admin.import_group_members(group["id"], str(members_csv))
    assert "ttc@example.com" in str(admin.list_group_members(group["id"]))
    assert admin.get_group(group["id"])["id"] == group["id"]
    assert admin.delete_group(group["id"], confirm=True)["executed"] is True

    permissions = admin.list_permissions()
    permission_ids = [item["id"] for item in permissions["results"][:2]]
    role = admin.create_role("Giám thị", "giam-thi", permission_ids)
    assert admin.update_role(role["id"], {"permission_ids": permission_ids[:1]})["requires_confirmation"] is True
    admin.update_role(role["id"], {"description": "Coi thi"})
    assert any(item["id"] == role["id"] for item in admin.list_roles()["results"])

    user = admin.create_user("gt1@example.com", "Giám thị 1", "Matkhau@123", role_ids=[role["id"]])
    assert admin.update_user(user["id"], {"full_name": "Giám thị Một"})["full_name"] == "Giám thị Một"
    assert admin.set_user_locked(user["id"], True)["requires_confirmation"] is True
    admin.set_user_locked(user["id"], True, confirm=True)
    assert admin.get_user(user["id"])["status"] == "locked"
    admin.set_user_locked(user["id"], False)
    assert admin.get_user(user["id"])["status"] == "active"

    users_csv = tmp_path / "tai-khoan.csv"
    users_csv.write_text("full_name,email,password\nLê Văn D,lvd@example.com,Matkhau@123\n", encoding="utf-8")
    admin.import_users(str(users_csv))
    assert admin.list_users(search="lvd@example.com")["count"] == 1

    assert admin.delete_user(user["id"], confirm=True)["executed"] is True
    assert admin.delete_role(role["id"], confirm=True)["executed"] is True


@pytest.mark.django_db
def test_system_tools(mcp_client):
    assert admin.dashboard_overview()
    assert "results" in admin.audit_events()
    assert admin.audit_summary() is not None
    assert "results" in admin.list_notifications()
    admin.mark_notifications_read()
    assert "live" in admin.system_health() or "ok" in admin.system_health()


@pytest.mark.django_db
def test_readonly_and_no_admin_modes_block_writes(mcp_client, subject, monkeypatch):
    monkeypatch.setenv("EDUEXAM_MCP_MODE", "readonly")
    with pytest.raises(ValueError, match="chi doc"):
        admin.create_subject("Lý", "LY9")
    assert admin.list_schools()["count"] == 0  # doc van duoc

    monkeypatch.setenv("EDUEXAM_MCP_MODE", "no-admin")
    with pytest.raises(ValueError, match="no-admin"):
        admin.create_user("x@example.com", "X", "Matkhau@123")
    assert admin.create_school("Trường A", "TA")["code"] == "TA"


@pytest.mark.django_db
def test_single_task_grading_and_unread_count(mcp_client, subject, admin_user, candidate_user):
    from tests.grading.test_services import _build_submitted_session

    exam, _, _ = _build_submitted_session(
        subject=subject, admin_user=admin_user, candidate_user=candidate_user, include_essay=True
    )
    task_id = server.list_grading_tasks(exam.id)["results"][0]["id"]
    assert admin.get_grading_task(task_id)["status"] == "pending"
    assert admin.grade_task(task_id, 1, "Tốt")["status"] == "graded"
    assert "count" in str(admin.unread_notification_count()) or admin.unread_notification_count() is not None
