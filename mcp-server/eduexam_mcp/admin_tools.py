"""
Tool quan tri cho toan bo he thong EduExam (tru phia thi sinh).

Nhom: cau hoi (CRUD) · de thi (sua, trang thai, nhan ban, phan cong, import thi sinh) · ket qua (cong bo, xuat file)
· giam sat & vi pham · ky luat & chung nhan · mon hoc · tai lieu · truong · nhom/lop · tai khoan · vai tro & quyen
· tong quan, nhat ky, thong bao, suc khoe he thong.

An toan:
- Thao tac xoa / khoa tai khoan / cong bo hang loat / ky luat hang loat can confirm=true.
- EDUEXAM_MCP_MODE=readonly chan moi thao tac ghi; =no-admin chan quan ly tai khoan & vai tro.
"""

from __future__ import annotations

from typing import Any

from .core import (
    call,
    clean,
    get_client,
    guard_write,
    mcp,
    needs_confirmation,
    read_local_file,
    save_download,
)

EXAM_STATUSES = ("draft", "scheduled", "open", "paused", "closed", "archived")


def _list(path: str, **params: Any) -> Any:
    return call(get_client().get, path, **params)


def _upload(path: str, file_path: str, data: dict | None = None, method: str = "POST") -> Any:
    name, content, content_type = read_local_file(file_path)
    return call(
        get_client().request,
        method,
        path,
        data={key: str(value).lower() if isinstance(value, bool) else value for key, value in (data or {}).items()},
        files={"file": (name, content, content_type)},
    )


def _download(path: str, fallback_name: str, save_dir: str = "", **params: Any) -> dict:
    content, file_name = call(get_client().download, path, **params)
    return save_download(content, file_name, fallback_name, save_dir)


# ============================== Cau hoi =================================================
@mcp.tool()
@guard_write()
def create_question(
    subject_id: int,
    question_type: str,
    difficulty: str,
    question_text: str,
    options: list[dict] | None = None,
    correct_option_keys: list[str] | None = None,
    essay_rubric: str = "",
    sample_answer: str = "",
    tags: list[str] | None = None,
) -> dict:
    """Tao 1 cau hoi. question_type: multiple_choice|true_false|essay; difficulty: easy|medium|hard.
    options: [{"key": "A", "text": "..."}], correct_option_keys: ["A"]. Nhieu cau -> dung import_questions."""
    return call(
        get_client().post,
        "/api/v1/questions/",
        {
            "subject_id": subject_id,
            "question_type": question_type,
            "difficulty": difficulty,
            "question_text": question_text,
            "options": options or [],
            "correct_option_keys": correct_option_keys or [],
            "essay_rubric": essay_rubric,
            "sample_answer": sample_answer,
            "tags": tags or [],
        },
    )


@mcp.tool()
@guard_write()
def update_question(question_id: int, changes: dict) -> dict:
    """Sua cau hoi (tao phien ban moi; de da dung ban cu khong bi doi). changes: cac truong nhu create_question."""
    return call(get_client().patch, f"/api/v1/questions/{question_id}/", changes)


@mcp.tool()
@guard_write()
def delete_question(question_id: int, confirm: bool = False) -> dict:
    """Xoa cau hoi khoi ngan hang (can confirm=true)."""
    pending = needs_confirmation(confirm, "Xoa cau hoi", question_id=question_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/questions/{question_id}/")
    return {"executed": True, "deleted_question_id": question_id}


@mcp.tool()
def list_question_tags(search: str = "", page: int = 1) -> dict:
    """Danh sach the (tag) cau hoi - dung cho luat ngau nhien (tag_ids)."""
    return _list("/api/v1/question-tags/", search=search, page=page)


# ============================== De thi ==================================================
@mcp.tool()
@guard_write()
def update_exam(exam_id: int, changes: dict) -> dict:
    """
    Sua de: changes co the gom name, description, duration_minutes, passing_score, max_attempts,
    shuffle_questions, show_results_immediately, enable_proctoring, opening_at, closing_at,
    manual_question_ids, random_rules, group_ids, user_ids. Doi trang thai -> dung set_exam_status.
    """
    return call(get_client().patch, f"/api/v1/exams/{exam_id}/", changes)


@mcp.tool()
@guard_write()
def set_exam_status(exam_id: int, status: str, bonus_minutes: int = 0, confirm: bool = False) -> dict:
    """
    Doi trang thai de: draft | scheduled | open | paused | closed | archived.
    - paused: dung dong ho moi thi sinh; open lai sau paused co the cong bonus_minutes.
    - closed: TU NOP BAI moi thi sinh dang lam (can confirm=true).
    """
    if status not in EXAM_STATUSES:
        raise ValueError(f"Trang thai khong hop le. Dung: {', '.join(EXAM_STATUSES)}")
    if status in {"closed", "archived"}:
        pending = needs_confirmation(
            confirm, f"Chuyen de sang '{status}' (thi sinh dang lam se bi nop bai)", exam_id=exam_id
        )
        if pending:
            return pending
    return call(get_client().patch, f"/api/v1/exams/{exam_id}/", clean({"status": status, "bonus_minutes": bonus_minutes or None}))


@mcp.tool()
@guard_write()
def clone_exam(exam_id: int, name: str, status: str = "draft", changes: dict | None = None) -> dict:
    """Nhan ban de (cau hoi, luat, cau hinh) thanh de moi. changes: tuy chon duration_minutes, passing_score..."""
    return call(get_client().post, f"/api/v1/exams/{exam_id}/clone/", {"name": name, "status": status, **(changes or {})})


@mcp.tool()
@guard_write()
def delete_exam(exam_id: int, confirm: bool = False) -> dict:
    """Xoa de thi (can confirm=true). De da co bai lam nen chuyen 'archived' thay vi xoa."""
    pending = needs_confirmation(confirm, "Xoa de thi", exam_id=exam_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/exams/{exam_id}/")
    return {"executed": True, "deleted_exam_id": exam_id}


@mcp.tool()
def get_exam_group_assignments(exam_id: int) -> dict:
    """Cac nhom/lop dang duoc phan cong lam de."""
    return _list(f"/api/v1/exams/{exam_id}/group-assignments/")


@mcp.tool()
@guard_write()
def set_exam_group_assignments(exam_id: int, group_ids: list[int]) -> dict:
    """Dat danh sach nhom/lop duoc lam de (THAY THE danh sach hien tai)."""
    return call(get_client().post, f"/api/v1/exams/{exam_id}/group-assignments/", {"group_ids": group_ids})


@mcp.tool()
@guard_write()
def import_students_to_exam(exam_id: int, file_path: str) -> dict:
    """
    Import thi sinh vao de tu file CSV tren may (tao tai khoan neu chua co va phan cong).
    Cot bat buoc: full_name, date_of_birth, student_class, cccd. Tuy chon: email, username, phone_number,
    school_code/school, candidate_number (SBD), password.
    """
    return _upload(f"/api/v1/exams/{exam_id}/student-import/", file_path)


@mcp.tool()
def exam_monitoring_hub(
    search: str = "", status: str = "", subject_id: int | None = None, severity: str = "", page: int = 1
) -> dict:
    """Tong quan giam sat moi de: so dang thi, canh bao, de co vi pham nghiem trong."""
    return _list(
        "/api/v1/proctoring/exams/monitoring/",
        search=search,
        status=status,
        subject=subject_id,
        severity=severity,
        page=page,
    )


# ============================== Ket qua =================================================
@mcp.tool()
def list_results(exam_id: int | None = None, publish_state: str = "", search: str = "", page: int = 1) -> dict:
    """Danh sach ket qua. publish_state: draft | published."""
    return _list("/api/v1/results/", exam=exam_id, publish_state=publish_state, search=search, page=page)


@mcp.tool()
def get_result(result_id: int) -> dict:
    """Chi tiet 1 ket qua."""
    return _list(f"/api/v1/results/{result_id}/")


@mcp.tool()
def get_result_review(result_id: int) -> dict:
    """Bai lam chi tiet cua 1 ket qua: tung cau, dap an chon, dung/sai, diem tu luan, nhan xet."""
    return _list(f"/api/v1/results/{result_id}/review/")


@mcp.tool()
def list_exam_candidates(exam_id: int) -> list | dict:
    """Danh sach thi sinh duoc phan cong vao de kem trang thai nop bai."""
    return _list("/api/v1/results/candidates/", exam=exam_id)


@mcp.tool()
@guard_write()
def publish_result(result_id: int) -> dict:
    """Cong bo 1 ket qua cho thi sinh (chi khi da cham xong va de da dong)."""
    return call(get_client().post, f"/api/v1/results/{result_id}/publish/", {})


@mcp.tool()
@guard_write()
def publish_exam_results(exam_id: int, confirm: bool = False) -> dict:
    """Cong bo moi ket qua da cham xong cua 1 de (can confirm=true)."""
    pending = needs_confirmation(confirm, "Cong bo toan bo ket qua da cham xong cua de", exam_id=exam_id)
    if pending:
        return pending
    return call(get_client().post, "/api/v1/results/bulk-publish/", {"exam_id": exam_id})


RESULT_EXPORTS = {
    "xlsx": ("/api/v1/results/export-xlsx/", "ket-qua.xlsx"),
    "csv": ("/api/v1/results/export-csv/", "ket-qua.csv"),
    "roster": ("/api/v1/results/exam-roster-export/", "danh-sach-thi-sinh.xlsx"),
    "unsubmitted": ("/api/v1/results/exam-unsubmitted-export/", "chua-nop-bai.xlsx"),
}


@mcp.tool()
def export_results(exam_id: int, kind: str = "xlsx", save_dir: str = "") -> dict:
    """
    Xuat file ket qua ra may: kind = xlsx (bang diem) | csv | roster (danh sach du thi + diem) |
    unsubmitted (thi sinh chua nop). Luu vao save_dir (mac dinh ~/Downloads/eduexam-exports).
    """
    if kind not in RESULT_EXPORTS:
        raise ValueError(f"kind phai la: {', '.join(RESULT_EXPORTS)}")
    path, fallback = RESULT_EXPORTS[kind]
    return _download(path, f"de-{exam_id}-{fallback}", save_dir, exam=exam_id)


@mcp.tool()
def export_result_review(result_id: int, save_dir: str = "") -> dict:
    """Xuat bai lam chi tiet cua 1 thi sinh ra file Excel."""
    return _download(f"/api/v1/results/{result_id}/review-export/", f"bai-lam-{result_id}.xlsx", save_dir)


# ============================== Giam sat & vi pham ======================================
@mcp.tool()
def list_violation_cases(
    exam_id: int | None = None, status: str = "", severity: str = "", search: str = "", page: int = 1
) -> dict:
    """Ho so vi pham giam sat. status: open | resolved | dismissed; severity: warning | critical."""
    return _list(
        "/api/v1/proctoring/cases/", exam=exam_id, status=status, severity=severity, search=search, page=page
    )


@mcp.tool()
def get_violation_case(case_id: int) -> dict:
    """Chi tiet ho so vi pham: su kien, anh bang chung (link xem tam thoi), lich su xu ly."""
    return _list(f"/api/v1/proctoring/cases/{case_id}/")


@mcp.tool()
@guard_write()
def resolve_violation_case(case_id: int, decision: str, notes: str = "") -> dict:
    """Ket luan ho so vi pham: decision = resolved (xac nhan vi pham) | dismissed (bo qua, khong vi pham)."""
    if decision not in {"resolved", "dismissed"}:
        raise ValueError("decision phai la resolved hoac dismissed.")
    return call(get_client().post, f"/api/v1/proctoring/cases/{case_id}/resolve/", {"decision": decision, "notes": notes})


@mcp.tool()
def export_violation_cases(exam_id: int | None = None, status: str = "", save_dir: str = "") -> dict:
    """Xuat danh sach ho so vi pham ra Excel."""
    return _download(
        "/api/v1/proctoring/cases/export/",
        f"vi-pham-{exam_id or 'tat-ca'}.xlsx",
        save_dir,
        exam=exam_id,
        status=status,
    )


# ============================== Ky luat & chung nhan ====================================
@mcp.tool()
def list_discipline_exams() -> Any:
    """Cac de co vi pham: so thi sinh vi pham, so ho so cho duyet, trang thai dong bo ket qua/chung nhan."""
    return _list("/api/v1/discipline/exams/")


@mcp.tool()
def list_discipline_cases(exam_id: int, page: int = 1) -> dict:
    """Ho so ky luat cua 1 de (de xuat tru diem, trang thai duyet)."""
    return _list(f"/api/v1/discipline/exams/{exam_id}/cases/", page=page)


@mcp.tool()
def list_discipline_records(exam_id: int, page: int = 1) -> dict:
    """Ban ghi ky luat da ap dung cua 1 de (ty le tru diem tung thi sinh)."""
    return _list(f"/api/v1/discipline/exams/{exam_id}/records/", page=page)


@mcp.tool()
@guard_write()
def propose_penalty(case_id: int, penalty_percent: float, notes: str = "") -> dict:
    """De xuat tru diem (%) cho 1 ho so vi pham (chua ap dung cho den khi duyet)."""
    return call(
        get_client().post,
        f"/api/v1/discipline/cases/{case_id}/proposal/",
        {"proposed_penalty_percent": penalty_percent, "notes": notes},
    )


@mcp.tool()
@guard_write()
def decide_penalty(
    case_id: int, decision: str, penalty_percent: float | None = None, notes: str = "", confirm: bool = False
) -> dict:
    """
    Quyet dinh ky luat 1 ho so: decision = approve (ap dung tru diem, cap nhat ket qua) | reject | no_penalty.
    approve can confirm=true vi anh huong diem thi sinh.
    """
    paths = {"approve": "approve", "reject": "reject", "no_penalty": "no-penalty"}
    if decision not in paths:
        raise ValueError("decision phai la approve | reject | no_penalty.")
    if decision == "approve":
        pending = needs_confirmation(
            confirm, "Ap dung tru diem (thay doi ket qua thi sinh)", case_id=case_id, penalty_percent=penalty_percent
        )
        if pending:
            return pending
    body = clean({"proposed_penalty_percent": penalty_percent, "notes": notes or None})
    return call(get_client().post, f"/api/v1/discipline/cases/{case_id}/{paths[decision]}/", body or None)


@mcp.tool()
@guard_write()
def bulk_discipline_action(
    exam_id: int,
    action: str,
    case_ids: list[int],
    penalty_percent: float | None = None,
    notes: str = "",
    confirm: bool = False,
) -> dict:
    """Xu ly ky luat hang loat: action = draft | approve | reject | no_penalty (can confirm=true)."""
    if action not in {"draft", "approve", "reject", "no_penalty"}:
        raise ValueError("action phai la draft | approve | reject | no_penalty.")
    pending = needs_confirmation(
        confirm, f"Ky luat hang loat ({action}) cho {len(case_ids)} ho so", exam_id=exam_id, case_ids=case_ids
    )
    if pending:
        return pending
    return call(
        get_client().post,
        f"/api/v1/discipline/exams/{exam_id}/bulk-apply/",
        clean({"action": action, "case_ids": case_ids, "proposed_penalty_percent": penalty_percent, "notes": notes}),
    )


CERTIFICATE_POLICY_EXAMPLE = {
    "mode": "score_threshold",
    "gold_config": {"threshold": 90},
    "silver_config": {"threshold": 80},
    "bronze_config": {"threshold": 65},
    "encouragement_config": {"threshold": 50},
}


@mcp.tool()
def get_certificate_policy(exam_id: int) -> dict:
    """Chinh sach xep loai chung nhan (Vang/Bac/Dong/Khuyen khich) cua de. Chua cau hinh -> configured=false + mau."""
    try:
        return {"configured": True, **_list(f"/api/v1/discipline/exams/{exam_id}/certificate-policy/")}
    except ValueError as exc:
        if "404" not in str(exc):
            raise
        return {"configured": False, "example": CERTIFICATE_POLICY_EXAMPLE}


@mcp.tool()
@guard_write()
def set_certificate_policy(exam_id: int, policy: dict) -> dict:
    """
    Dat chinh sach chung nhan. mode:
    - score_threshold: moi muc {"threshold": % diem toi thieu}
    - rank_ratio / rank_ratio_with_minimum: theo ty le xep hang (xem get_certificate_policy de giu dung cau truc).
    Vi du: {"mode": "score_threshold", "gold_config": {"threshold": 90}, "silver_config": {"threshold": 80},
    "bronze_config": {"threshold": 65}, "encouragement_config": {"threshold": 50}}
    """
    policy = {key: value for key, value in policy.items() if key != "configured"}
    return call(get_client().put, f"/api/v1/discipline/exams/{exam_id}/certificate-policy/", policy)


@mcp.tool()
@guard_write()
def recompute_certificates(exam_id: int) -> dict:
    """Tinh lai xep loai chung nhan cua de sau khi doi diem/ky luat/chinh sach."""
    return call(get_client().post, f"/api/v1/discipline/exams/{exam_id}/certificate-recompute/", {})


@mcp.tool()
def export_discipline(exam_id: int, kind: str = "records", save_dir: str = "") -> dict:
    """Xuat Excel ky luat: kind = records (bang ky luat/chung nhan) | cases (ho so vi pham)."""
    paths = {
        "records": f"/api/v1/discipline/exams/{exam_id}/export/",
        "cases": f"/api/v1/discipline/exams/{exam_id}/cases/export/",
    }
    if kind not in paths:
        raise ValueError("kind phai la records | cases.")
    return _download(paths[kind], f"ky-luat-{kind}-de-{exam_id}.xlsx", save_dir)


# ============================== Mon hoc =================================================
@mcp.tool()
@guard_write()
def create_subject(name: str, code: str, description: str = "", color: str = "bg-blue-600") -> dict:
    """Tao mon hoc (code duy nhat, dung khi import cau hoi)."""
    return call(get_client().post, "/api/v1/subjects/", {"name": name, "code": code, "description": description, "color": color})


@mcp.tool()
@guard_write()
def update_subject(subject_id: int, changes: dict) -> dict:
    """Sua mon hoc: name, code, description, color, is_active."""
    return call(get_client().patch, f"/api/v1/subjects/{subject_id}/", changes)


@mcp.tool()
@guard_write()
def delete_subject(subject_id: int, confirm: bool = False) -> dict:
    """Xoa mon hoc (can confirm=true; mon da co cau hoi/de se bi tu choi -> nen dat is_active=false)."""
    pending = needs_confirmation(confirm, "Xoa mon hoc", subject_id=subject_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/subjects/{subject_id}/")
    return {"executed": True, "deleted_subject_id": subject_id}


# ============================== Tai lieu hoc tap ========================================
@mcp.tool()
def list_materials(search: str = "", subject_id: int | None = None, is_active: bool | None = None, page: int = 1) -> dict:
    """Danh sach tai lieu hoc tap."""
    return _list(
        "/api/v1/materials/",
        search=search,
        subject=subject_id,
        is_active=None if is_active is None else str(is_active).lower(),
        page=page,
    )


@mcp.tool()
@guard_write()
def upload_material(file_path: str, title: str, subject_id: int, description: str = "", is_active: bool = True) -> dict:
    """Tai len tai lieu tu file tren may (PDF, Word, PowerPoint, anh, video...)."""
    return _upload(
        "/api/v1/materials/",
        file_path,
        {"title": title, "subject_id": subject_id, "description": description, "is_active": is_active},
    )


@mcp.tool()
@guard_write()
def update_material(material_id: int, changes: dict) -> dict:
    """Sua thong tin tai lieu: title, description, subject_id, is_active. Thay file -> file_path trong changes."""
    changes = dict(changes)
    file_path = changes.pop("file_path", None)
    form = {key: str(value).lower() if isinstance(value, bool) else value for key, value in changes.items()}
    if file_path:
        return _upload(f"/api/v1/materials/{material_id}/", file_path, form, method="PATCH")
    # API tai lieu chi nhan multipart/form-data.
    return call(get_client().request, "PATCH", f"/api/v1/materials/{material_id}/", data=form, files={})


@mcp.tool()
@guard_write()
def delete_material(material_id: int, confirm: bool = False) -> dict:
    """Xoa tai lieu (can confirm=true)."""
    pending = needs_confirmation(confirm, "Xoa tai lieu", material_id=material_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/materials/{material_id}/")
    return {"executed": True, "deleted_material_id": material_id}


@mcp.tool()
def download_material(material_id: int, save_dir: str = "") -> dict:
    """Tai file tai lieu ve may (tang luot tai). Neu khong tai duoc thi tra ve file_url de mo bang trinh duyet."""
    import httpx

    client = get_client()
    info = call(client.get, f"/api/v1/materials/{material_id}/download/")
    file_url = info.get("file_url") or ""
    if not file_url:
        return {"file_url": "", "error": "Tai lieu khong co file."}
    absolute = file_url if file_url.startswith("http") else f"{client.base_url}{file_url}"
    try:
        response = httpx.get(absolute, timeout=120, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        return {"file_url": absolute, "saved_to": None, "error": f"Khong tai duoc: {exc}"}
    name = absolute.split("?", 1)[0].rsplit("/", 1)[-1]
    return {"file_url": absolute, **save_download(response.content, name, f"tai-lieu-{material_id}", save_dir)}


# ============================== Truong hoc ==============================================
@mcp.tool()
def list_schools(search: str = "", page: int = 1) -> dict:
    """Danh sach truong."""
    return _list("/api/v1/schools/", search=search, page=page)


@mcp.tool()
@guard_write()
def create_school(name: str, code: str, description: str = "") -> dict:
    """Tao truong (code duy nhat, dung trong file import thi sinh: school_code)."""
    return call(get_client().post, "/api/v1/schools/", {"name": name, "code": code, "description": description})


@mcp.tool()
@guard_write()
def update_school(school_id: int, changes: dict) -> dict:
    """Sua truong: name, code, description, is_active."""
    return call(get_client().patch, f"/api/v1/schools/{school_id}/", changes)


@mcp.tool()
@guard_write()
def delete_school(school_id: int, confirm: bool = False) -> dict:
    """Xoa truong (can confirm=true)."""
    pending = needs_confirmation(confirm, "Xoa truong", school_id=school_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/schools/{school_id}/")
    return {"executed": True, "deleted_school_id": school_id}


# ============================== Nhom / lop ==============================================
@mcp.tool()
def list_groups(search: str = "", is_active: bool | None = None, page: int = 1) -> dict:
    """Danh sach nhom/lop thi sinh."""
    return _list(
        "/api/v1/groups/", search=search, is_active=None if is_active is None else str(is_active).lower(), page=page
    )


@mcp.tool()
def get_group(group_id: int) -> dict:
    """Chi tiet nhom/lop."""
    return _list(f"/api/v1/groups/{group_id}/")


@mcp.tool()
@guard_write()
def create_group(name: str, description: str = "", is_active: bool = True) -> dict:
    """Tao nhom/lop thi sinh."""
    return call(get_client().post, "/api/v1/groups/", {"name": name, "description": description, "is_active": is_active})


@mcp.tool()
@guard_write()
def update_group(group_id: int, changes: dict) -> dict:
    """Sua nhom/lop: name, description, is_active."""
    return call(get_client().patch, f"/api/v1/groups/{group_id}/", changes)


@mcp.tool()
@guard_write()
def delete_group(group_id: int, confirm: bool = False) -> dict:
    """Xoa nhom/lop (can confirm=true; tai khoan thi sinh khong bi xoa)."""
    pending = needs_confirmation(confirm, "Xoa nhom/lop", group_id=group_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/groups/{group_id}/")
    return {"executed": True, "deleted_group_id": group_id}


@mcp.tool()
def list_group_members(group_id: int, search: str = "", page: int = 1) -> Any:
    """Thanh vien cua nhom/lop."""
    return _list(f"/api/v1/groups/{group_id}/memberships/", search=search, page=page)


@mcp.tool()
@guard_write()
def add_group_member(group_id: int, user_id: int) -> dict:
    """Them 1 tai khoan vao nhom/lop."""
    return call(get_client().post, f"/api/v1/groups/{group_id}/memberships/", {"user_id": user_id})


@mcp.tool()
@guard_write()
def remove_group_member(group_id: int, user_id: int) -> dict:
    """Bo 1 tai khoan khoi nhom/lop (khong xoa tai khoan)."""
    call(get_client().delete, f"/api/v1/groups/{group_id}/memberships/", user_id=user_id)
    return {"executed": True, "group_id": group_id, "removed_user_id": user_id}


@mcp.tool()
@guard_write()
def import_group_members(group_id: int, file_path: str) -> dict:
    """
    Import thanh vien vao nhom tu CSV tren may (tao tai khoan neu chua co). Cot bat buoc: full_name.
    Tuy chon: email, username, cccd, phone_number, student_class, date_of_birth, school_code/school,
    candidate_number (hoac sbd), password, ward, exam_block, national_exam_subject.
    """
    return _upload(f"/api/v1/groups/{group_id}/memberships/import/", file_path)


# ============================== Tai khoan (quan tri) ====================================
@mcp.tool()
def list_users(search: str = "", role: str = "", status: str = "", page: int = 1) -> dict:
    """Danh sach tai khoan. role: slug vai tro; status: active | locked | ..."""
    return _list("/api/v1/users/", search=search, role=role, status=status, page=page)


@mcp.tool()
def get_user(user_id: int) -> dict:
    """Chi tiet tai khoan."""
    return _list(f"/api/v1/users/{user_id}/")


@mcp.tool()
@guard_write(admin=True)
def create_user(
    email: str,
    full_name: str,
    password: str,
    username: str = "",
    role_ids: list[int] | None = None,
    school_id: int | None = None,
    candidate_number: str = "",
    student_class: str = "",
    phone_number: str = "",
    is_staff: bool = False,
) -> dict:
    """Tao tai khoan. role_ids lay tu list_roles. Thi sinh hang loat -> import_users / import_group_members."""
    return call(
        get_client().post,
        "/api/v1/users/",
        clean(
            {
                "email": email,
                "full_name": full_name,
                "password": password,
                "username": username or None,
                "role_ids": role_ids or [],
                "school_id": school_id,
                "candidate_number": candidate_number,
                "student_class": student_class,
                "phone_number": phone_number,
                "is_staff": is_staff,
            }
        ),
    )


@mcp.tool()
@guard_write(admin=True)
def update_user(user_id: int, changes: dict) -> dict:
    """Sua tai khoan: full_name, email, username, phone_number, school_id, candidate_number, student_class,
    role_ids, is_staff, password (dat lai mat khau)..."""
    return call(get_client().patch, f"/api/v1/users/{user_id}/", changes)


@mcp.tool()
@guard_write(admin=True)
def set_user_locked(user_id: int, locked: bool, confirm: bool = False) -> dict:
    """Khoa (locked=true, can confirm) hoac mo khoa tai khoan."""
    if locked:
        pending = needs_confirmation(confirm, "Khoa tai khoan (nguoi dung khong dang nhap duoc)", user_id=user_id)
        if pending:
            return pending
    return call(get_client().post, f"/api/v1/users/{user_id}/{'lock' if locked else 'unlock'}/", {})


@mcp.tool()
@guard_write(admin=True)
def delete_user(user_id: int, confirm: bool = False) -> dict:
    """Xoa tai khoan (can confirm=true; nen khoa thay vi xoa de giu lich su thi)."""
    pending = needs_confirmation(confirm, "Xoa tai khoan vinh vien", user_id=user_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/users/{user_id}/")
    return {"executed": True, "deleted_user_id": user_id}


@mcp.tool()
@guard_write(admin=True)
def import_users(file_path: str) -> dict:
    """Import tai khoan tu CSV tren may. Cot bat buoc: full_name, email. Tuy chon: username, password,
    status, is_active, is_staff, phone_number, school_code/school, role_slugs (phan cach bang |)."""
    return _upload("/api/v1/users/import-csv/", file_path)


# ============================== Vai tro & quyen =========================================
@mcp.tool()
def list_roles(search: str = "", page: int = 1) -> dict:
    """Danh sach vai tro va quyen cua tung vai tro."""
    return _list("/api/v1/roles/", search=search, page=page)


@mcp.tool()
def list_permissions(page: int = 1, page_size: int = 200) -> dict:
    """Danh sach quyen (code) co the gan cho vai tro."""
    return _list("/api/v1/permissions/", page=page, page_size=page_size)


@mcp.tool()
@guard_write(admin=True)
def create_role(name: str, slug: str, permission_ids: list[int], description: str = "") -> dict:
    """Tao vai tro voi danh sach quyen."""
    return call(
        get_client().post,
        "/api/v1/roles/",
        {"name": name, "slug": slug, "description": description, "permission_ids": permission_ids, "is_active": True},
    )


@mcp.tool()
@guard_write(admin=True)
def update_role(role_id: int, changes: dict, confirm: bool = False) -> dict:
    """Sua vai tro (name, description, is_active, permission_ids). Doi quyen can confirm=true."""
    if "permission_ids" in changes or "is_active" in changes:
        pending = needs_confirmation(confirm, "Thay doi quyen han cua vai tro", role_id=role_id, changes=changes)
        if pending:
            return pending
    return call(get_client().patch, f"/api/v1/roles/{role_id}/", changes)


@mcp.tool()
@guard_write(admin=True)
def delete_role(role_id: int, confirm: bool = False) -> dict:
    """Xoa vai tro (can confirm=true)."""
    pending = needs_confirmation(confirm, "Xoa vai tro", role_id=role_id)
    if pending:
        return pending
    call(get_client().delete, f"/api/v1/roles/{role_id}/")
    return {"executed": True, "deleted_role_id": role_id}


# ============================== He thong ================================================
@mcp.tool()
def dashboard_overview() -> dict:
    """So lieu tong quan he thong (thi sinh, ky thi, ngan hang cau hoi, ty le hoan thanh...)."""
    return _list("/api/v1/dashboard/overview/")


@mcp.tool()
def audit_events(
    search: str = "",
    category: str = "",
    severity: str = "",
    action: str = "",
    date_from: str = "",
    date_to: str = "",
    page: int = 1,
) -> dict:
    """Nhat ky he thong (ai lam gi, khi nao). date_from/date_to: YYYY-MM-DD."""
    return _list(
        "/api/v1/audit/events/",
        search=search,
        category=category,
        severity=severity,
        action=action,
        date_from=date_from,
        date_to=date_to,
        page=page,
    )


@mcp.tool()
def audit_summary() -> dict:
    """Thong ke nhat ky theo nhom/muc do."""
    return _list("/api/v1/audit/events/summary/")


@mcp.tool()
def list_notifications(is_read: bool | None = None, category: str = "", priority: str = "", page: int = 1) -> dict:
    """Thong bao cua tai khoan MCP (canh bao vi pham, cham bai...)."""
    return _list(
        "/api/v1/notifications/",
        is_read=None if is_read is None else str(is_read).lower(),
        category=category,
        priority=priority,
        page=page,
    )


@mcp.tool()
@guard_write()
def mark_notifications_read(notification_ids: list[int] | None = None) -> dict:
    """Danh dau da doc: cac ID chi dinh, hoac tat ca neu bo trong."""
    client = get_client()
    if not notification_ids:
        return call(client.post, "/api/v1/notifications/mark-all-read/", {})
    for notification_id in notification_ids:
        call(client.post, f"/api/v1/notifications/{notification_id}/mark-read/", {})
    return {"marked_read": notification_ids}


@mcp.tool()
def system_health() -> dict:
    """Kiem tra he thong: backend, CSDL, Redis (health/ready)."""
    client = get_client()
    try:
        return {"live": call(client.get, "/api/v1/health/live/"), "ready": call(client.get, "/api/v1/health/ready/")}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}


# ============================== Bo sung: cham tung bai, thong bao ========================
@mcp.tool()
def get_grading_task(task_id: int) -> dict:
    """Chi tiet 1 bai tu luan can cham (cau hoi, bai lam, diem toi da, goi y AI neu co)."""
    return _list(f"/api/v1/grading/tasks/{task_id}/")


@mcp.tool()
@guard_write()
def grade_task(task_id: int, score_awarded: float, feedback: str = "") -> dict:
    """Ghi DIEM CHINH THUC cho 1 bai tu luan (nhieu bai -> bulk_grade)."""
    return call(
        get_client().post,
        f"/api/v1/grading/tasks/{task_id}/grade/",
        {"score_awarded": score_awarded, "feedback": feedback},
    )


@mcp.tool()
def unread_notification_count() -> dict:
    """So thong bao chua doc cua tai khoan MCP."""
    return _list("/api/v1/notifications/unread-count/")
