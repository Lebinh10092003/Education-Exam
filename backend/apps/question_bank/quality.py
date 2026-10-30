"""
Kiem tra chat luong cau hoi truoc/khi import (dung chung cho import that, che do chay thu va MCP).

Moi van de tra ve dang {"level": "error"|"warning", "field": ..., "code": ..., "message": ...}.
- error  : cau hoi khong duoc import (sai du lieu, thi sinh khong the lam dung).
- warning: van import duoc nhung nen xem lai (trung lap, thieu barem...).
"""

import re
import unicodedata
from collections import Counter

from django.db.models import F

from apps.academics.models import Subject

from .models import Question, QuestionRevision

DIFFICULTY_ALIASES = {
    "de": Question.Difficulty.EASY,
    "dễ": Question.Difficulty.EASY,
    "nhan biet": Question.Difficulty.EASY,
    "nhận biết": Question.Difficulty.EASY,
    "trung binh": Question.Difficulty.MEDIUM,
    "trung bình": Question.Difficulty.MEDIUM,
    "tb": Question.Difficulty.MEDIUM,
    "thong hieu": Question.Difficulty.MEDIUM,
    "thông hiểu": Question.Difficulty.MEDIUM,
    "kho": Question.Difficulty.HARD,
    "khó": Question.Difficulty.HARD,
    "van dung": Question.Difficulty.HARD,
    "vận dụng": Question.Difficulty.HARD,
}
TYPE_ALIASES = {
    "trac nghiem": Question.Type.MULTIPLE_CHOICE,
    "trắc nghiệm": Question.Type.MULTIPLE_CHOICE,
    "mcq": Question.Type.MULTIPLE_CHOICE,
    "multiple choice": Question.Type.MULTIPLE_CHOICE,
    "tu luan": Question.Type.ESSAY,
    "tự luận": Question.Type.ESSAY,
    "dung sai": Question.Type.TRUE_FALSE,
    "đúng sai": Question.Type.TRUE_FALSE,
    "đúng/sai": Question.Type.TRUE_FALSE,
    "true/false": Question.Type.TRUE_FALSE,
    "true false": Question.Type.TRUE_FALSE,
}
OBJECTIVE_TYPES = {Question.Type.MULTIPLE_CHOICE, Question.Type.TRUE_FALSE}


def _issue(level, field, code, message):
    return {"level": level, "field": field, "code": code, "message": message}


def normalize_choice(value, *, valid, aliases):
    """Chap nhan ca gia tri chuan (easy, multiple_choice) lan cach viet tieng Viet (Dễ, Trắc nghiệm)."""
    cleaned = str(value or "").strip().lower()
    if cleaned in valid:
        return cleaned
    return str(aliases.get(cleaned, value or "")).strip()


def normalize_question_text(text):
    """Chuan hoa de so trung: bo dau cach thua, khong phan biet hoa thuong, bo dau cau cuoi."""
    text = unicodedata.normalize("NFC", str(text or "")).lower()
    text = re.sub(r"\s+", " ", text).strip()
    return text.rstrip(" .?!:;")


def validate_question_fields(*, question_type, difficulty, question_text, options, correct_option_keys,
                             essay_rubric="", sample_answer=""):
    issues = []
    if question_type not in Question.Type.values:
        issues.append(_issue(
            "error", "question_type", "invalid_type",
            f"Loại câu hỏi '{question_type}' không hợp lệ. Dùng: {', '.join(Question.Type.values)}.",
        ))
    if difficulty not in Question.Difficulty.values:
        issues.append(_issue(
            "error", "difficulty", "invalid_difficulty",
            f"Độ khó '{difficulty}' không hợp lệ. Dùng: {', '.join(Question.Difficulty.values)} (hoặc Dễ/Trung bình/Khó).",
        ))
    if not str(question_text or "").strip():
        issues.append(_issue("error", "question_text", "empty_text", "Nội dung câu hỏi đang trống."))

    options = options or []
    correct_option_keys = [str(key).strip() for key in (correct_option_keys or []) if str(key).strip()]
    if question_type in OBJECTIVE_TYPES:
        keys = [str(option.get("key", "")).strip() for option in options]
        texts = [str(option.get("text", "")).strip() for option in options]
        if len(options) < 2:
            issues.append(_issue("error", "options", "too_few_options", "Câu trắc nghiệm cần ít nhất 2 phương án."))
        duplicated_keys = sorted(key for key, count in Counter(keys).items() if count > 1)
        if duplicated_keys:
            issues.append(_issue("error", "options", "duplicate_option_keys",
                                 f"Trùng ký hiệu phương án: {', '.join(duplicated_keys)}."))
        if any(not text for text in texts):
            issues.append(_issue("error", "options", "empty_option", "Có phương án để trống nội dung."))
        normalized_texts = [normalize_question_text(text) for text in texts if text]
        if len(set(normalized_texts)) < len(normalized_texts):
            issues.append(_issue("warning", "options", "duplicate_option_text", "Có hai phương án nội dung giống nhau."))
        if not correct_option_keys:
            issues.append(_issue("error", "correct_option_keys", "missing_answer", "Chưa có đáp án đúng."))
        missing = [key for key in correct_option_keys if key not in keys]
        if missing:
            issues.append(_issue("error", "correct_option_keys", "answer_not_in_options",
                                 f"Đáp án {', '.join(missing)} không có trong danh sách phương án."))
        # Giao dien lam bai chi cho chon 1 phuong an -> cau nhieu dap an se luon bi cham sai.
        if len(set(correct_option_keys)) > 1:
            issues.append(_issue("error", "correct_option_keys", "multiple_answers",
                                 "Có nhiều hơn 1 đáp án đúng, nhưng thí sinh chỉ chọn được 1 phương án nên sẽ luôn bị chấm sai."))
        if question_type == Question.Type.TRUE_FALSE and len(options) != 2:
            issues.append(_issue("warning", "options", "true_false_options", "Câu Đúng/Sai nên có đúng 2 phương án."))
    elif question_type == Question.Type.ESSAY:
        if not str(essay_rubric or "").strip() and not str(sample_answer or "").strip():
            issues.append(_issue("warning", "essay_rubric", "missing_rubric",
                                 "Câu tự luận chưa có barem hoặc đáp án mẫu, người chấm khó chấm thống nhất."))
        if options:
            issues.append(_issue("warning", "options", "essay_has_options", "Câu tự luận có phương án, sẽ bị bỏ qua."))
    return issues


def _split_list(value):
    if isinstance(value, str):
        return [item.strip() for item in value.split("|") if item.strip()]
    return list(value or [])


def build_question_payload_from_row(row, subjects_cache=None):
    """Doc 1 dong import (CSV/XLSX/JSON) thanh payload. Loi khong sua duoc -> ValueError."""
    if not isinstance(row, dict):
        raise ValueError("Mỗi câu hỏi phải là một đối tượng (dòng có tiêu đề cột).")
    subject_code = str(row.get("subject_code", "")).strip()
    if not subject_code:
        raise ValueError("Thiếu subject_code (mã môn học).")
    subjects_cache = subjects_cache if subjects_cache is not None else {}
    if subject_code not in subjects_cache:
        subjects_cache[subject_code] = Subject.objects.filter(code=subject_code).first()
    subject = subjects_cache[subject_code]
    if subject is None:
        raise ValueError(f"Không tìm thấy môn học có mã '{subject_code}'.")

    options = row.get("options")
    if options is None:
        options = [
            {"key": key.replace("option_", "").upper(), "text": str(value).strip()}
            for key, value in row.items()
            if str(key).startswith("option_") and str(value or "").strip()
        ]

    return {
        "subject": subject,
        "difficulty": normalize_choice(row.get("difficulty"), valid=Question.Difficulty.values, aliases=DIFFICULTY_ALIASES),
        "question_type": normalize_choice(row.get("question_type"), valid=Question.Type.values, aliases=TYPE_ALIASES),
        "question_text": str(row.get("question_text") or "").strip(),
        "tags": _split_list(row.get("tags", [])),
        "options": options,
        "correct_option_keys": [str(key).strip().upper() for key in _split_list(row.get("correct_option_keys", []))],
        "essay_rubric": row.get("essay_rubric", "") or "",
        "sample_answer": row.get("sample_answer", "") or "",
        "acceptable_answers": _split_list(row.get("acceptable_answers", [])),
    }


def _existing_texts_by_subject(subject_ids):
    """{subject_id: {van ban chuan hoa: question_id}} cho cau hoi dang dung trong ngan hang."""
    existing = {subject_id: {} for subject_id in subject_ids}
    if not subject_ids:
        return existing
    rows = QuestionRevision.objects.filter(
        question__subject_id__in=subject_ids,
        question__current_revision_id=F("id"),
    ).values_list("question__subject_id", "question_id", "question_text")
    for subject_id, question_id, text in rows:
        existing[subject_id].setdefault(normalize_question_text(text), question_id)
    return existing


def _summary(row, payload):
    text = (payload or {}).get("question_text") or str((row or {}).get("question_text", "") if isinstance(row, dict) else "")
    return {
        "subject_code": str(row.get("subject_code", "")).strip() if isinstance(row, dict) else "",
        "question_type": (payload or {}).get("question_type", ""),
        "difficulty": (payload or {}).get("difficulty", ""),
        "question_preview": text[:120],
    }


def analyze_import_rows(rows):
    """
    Kiem tra toan bo file import ma KHONG ghi gi vao CSDL.
    Tra ve bao cao tong hop + danh sach van de theo tung dong (dong 1 = cau hoi dau tien).
    """
    subjects_cache = {}
    parsed = []
    for index, row in enumerate(rows, start=1):
        try:
            payload = build_question_payload_from_row(row, subjects_cache=subjects_cache)
            issues = validate_question_fields(
                question_type=payload["question_type"],
                difficulty=payload["difficulty"],
                question_text=payload["question_text"],
                options=payload["options"],
                correct_option_keys=payload["correct_option_keys"],
                essay_rubric=payload["essay_rubric"],
                sample_answer=payload["sample_answer"],
            )
        except ValueError as exc:
            payload = None
            issues = [_issue("error", "subject_code", "invalid_row", str(exc))]
        parsed.append((index, row, payload, issues))

    subject_ids = {payload["subject"].id for _, _, payload, _ in parsed if payload}
    existing = _existing_texts_by_subject(subject_ids)
    seen_in_file = {}
    for index, _, payload, issues in parsed:
        if not payload or not payload["question_text"]:
            continue
        key = (payload["subject"].id, normalize_question_text(payload["question_text"]))
        if key in seen_in_file:
            issues.append(_issue("warning", "question_text", "duplicate_in_file",
                                 f"Trùng nội dung với câu ở dòng {seen_in_file[key]} trong cùng file."))
        else:
            seen_in_file[key] = index
        existing_id = existing.get(key[0], {}).get(key[1])
        if existing_id:
            issues.append(_issue("warning", "question_text", "duplicate_in_bank",
                                 f"Trùng với câu hỏi #{existing_id} đã có trong ngân hàng."))

    report_rows = []
    stats = {"by_type": Counter(), "by_difficulty": Counter(), "by_subject": Counter()}
    for index, row, payload, issues in parsed:
        has_error = any(issue["level"] == "error" for issue in issues)
        status = "error" if has_error else ("warning" if issues else "ok")
        if payload and not has_error:
            stats["by_type"][payload["question_type"]] += 1
            stats["by_difficulty"][payload["difficulty"]] += 1
            stats["by_subject"][payload["subject"].code] += 1
        report_rows.append({"row": index, "status": status, "issues": issues, **_summary(row, payload)})

    return {
        "total_rows": len(report_rows),
        "importable_rows": sum(1 for item in report_rows if item["status"] != "error"),
        "error_rows": sum(1 for item in report_rows if item["status"] == "error"),
        "warning_rows": sum(1 for item in report_rows if item["status"] == "warning"),
        "stats": {name: dict(counter) for name, counter in stats.items()},
        "rows": report_rows,
        "_parsed": parsed,
    }


def public_report(report):
    return {key: value for key, value in report.items() if not key.startswith("_")}
