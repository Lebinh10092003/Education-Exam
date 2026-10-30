"""
Kiem tra de thi truoc khi mo cho thi sinh (dung cho API va MCP).

Bao cao gom:
- issues: danh sach van de (error = de chua the to chuc dung, warning = nen xem lai, info = thong tin)
- stats : so cau, tong diem, phan bo loai cau/do kho, so thi sinh duoc phan cong...
"""

from collections import Counter
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Q

from apps.question_bank.models import Question
from apps.question_bank.quality import normalize_question_text, validate_question_fields

from .models import Exam, ExamItem


def _issue(level, code, message, **extra):
    return {"level": level, "code": code, "message": message, **extra}


def _random_rule_pool_ids(*, exam, rule):
    queryset = Question.objects.filter(subject_id=exam.subject_id, current_revision__isnull=False)
    if rule.difficulty:
        queryset = queryset.filter(difficulty=rule.difficulty)
    if rule.question_type:
        queryset = queryset.filter(question_type=rule.question_type)
    if rule.tag_ids:
        queryset = queryset.filter(tags__id__in=rule.tag_ids)
    return set(queryset.values_list("id", flat=True).distinct())


def _assigned_candidate_count(exam):
    user_model = get_user_model()
    return (
        user_model.objects.filter(
            Q(exam_assignments__exam=exam)
            | Q(group_memberships__group__exam_assignments__exam=exam, group_memberships__is_active=True)
        )
        .distinct()
        .count()
    )


def check_exam(exam: Exam):
    issues = []
    stats = {}

    version = exam.current_version
    if version is None:
        issues.append(_issue("error", "no_version", "Đề chưa có phiên bản câu hỏi nào."))
        return _build_report(exam, issues, stats)

    items = list(
        version.items.select_related(
            "question_revision",
            "question_revision__question",
            "question_revision__answer_key",
        )
        .prefetch_related("question_revision__options")
        .order_by("sort_order")
    )
    rules = list(version.random_rules.order_by("sort_order"))
    manual_items = [item for item in items if item.source == ExamItem.Source.MANUAL]
    random_items = [item for item in items if item.source == ExamItem.Source.RANDOM]

    if not items:
        issues.append(_issue("error", "no_questions", "Đề chưa có câu hỏi nào."))

    # --- Tung cau hoi trong de --------------------------------------------------------
    seen_questions = {}
    seen_texts = {}
    by_type = Counter()
    by_difficulty = Counter()
    total_points = Decimal("0")
    for position, item in enumerate(items, start=1):
        revision = item.question_revision
        question = revision.question
        label = f"Câu {position} (#{question.id})"
        total_points += item.points
        by_type[question.question_type] += 1
        by_difficulty[question.difficulty] += 1

        if item.points <= 0:
            issues.append(_issue("error", "zero_points", f"{label} có điểm {item.points} (phải > 0).",
                                 question_id=question.id, position=position))
        if question.subject_id != exam.subject_id:
            issues.append(_issue("warning", "other_subject", f"{label} thuộc môn khác với môn của đề.",
                                 question_id=question.id, position=position))
        if question.current_revision_id and question.current_revision_id != revision.id:
            issues.append(_issue("warning", "outdated_revision",
                                 f"{label} đã được sửa trong ngân hàng sau khi đưa vào đề; đề vẫn dùng bản cũ.",
                                 question_id=question.id, position=position))
        if question.id in seen_questions:
            issues.append(_issue("error", "duplicate_question",
                                 f"{label} lặp lại câu {seen_questions[question.id]}.",
                                 question_id=question.id, position=position))
        seen_questions.setdefault(question.id, position)
        normalized = normalize_question_text(revision.question_text)
        if normalized and normalized in seen_texts and seen_texts[normalized] != seen_questions[question.id]:
            issues.append(_issue("warning", "duplicate_text",
                                 f"{label} có nội dung giống câu {seen_texts[normalized]}.",
                                 question_id=question.id, position=position))
        seen_texts.setdefault(normalized, position)

        answer_key = getattr(revision, "answer_key", None)
        for field_issue in validate_question_fields(
            question_type=question.question_type,
            difficulty=question.difficulty,
            question_text=revision.question_text,
            options=[{"key": option.key, "text": option.text} for option in revision.options.all()],
            correct_option_keys=getattr(answer_key, "correct_option_keys", []) or [],
            essay_rubric=getattr(answer_key, "essay_rubric", ""),
            sample_answer=getattr(answer_key, "sample_answer", ""),
        ):
            issues.append(_issue(field_issue["level"], field_issue["code"], f"{label}: {field_issue['message']}",
                                 question_id=question.id, position=position))

    # --- Luat sinh de ngau nhien -----------------------------------------------------
    total_rule_count = sum(rule.count for rule in rules)
    if rules and len(random_items) != total_rule_count:
        issues.append(_issue("warning", "random_rule_mismatch",
                             f"Luật ngẫu nhiên cần {total_rule_count} câu nhưng đề có {len(random_items)} vị trí ngẫu nhiên; "
                             "mọi thí sinh sẽ nhận cùng bộ câu cố định."))
    excluded = {item.question_revision.question_id for item in manual_items}
    earlier_pools = set()
    rule_reports = []
    for rule in rules:
        pool = _random_rule_pool_ids(exam=exam, rule=rule) - excluded
        label = (
            f"Luật #{rule.sort_order} ({rule.difficulty or 'mọi độ khó'}, "
            f"{rule.question_type or 'mọi loại'}, {rule.count} câu)"
        )
        rule_reports.append({"sort_order": rule.sort_order, "required": rule.count, "available": len(pool)})
        if len(pool) < rule.count:
            issues.append(_issue("error", "random_pool_too_small",
                                 f"{label}: ngân hàng chỉ có {len(pool)} câu phù hợp, thí sinh sẽ không vào thi được."))
        elif len(pool - earlier_pools) < rule.count:
            # Khi sinh de, cau da rut cho luat truoc bi loai khoi luat sau.
            issues.append(_issue("warning", "random_pool_overlap",
                                 f"{label}: trùng tập câu với luật trước; có thể thiếu câu khi luật trước rút trúng."))
        elif len(pool) < rule.count * 2:
            issues.append(_issue("warning", "random_pool_small",
                                 f"{label}: chỉ có {len(pool)} câu phù hợp, các thí sinh sẽ nhận đề rất giống nhau."))
        earlier_pools |= pool

    # --- Lich thi, phan cong, cau hinh --------------------------------------------------
    window = getattr(exam, "schedule_window", None)
    opens_at = getattr(window, "opens_at", None)
    closes_at = getattr(window, "closes_at", None)
    if exam.status == Exam.Status.DRAFT:
        issues.append(_issue("info", "draft", "Đề đang ở trạng thái nháp, thí sinh chưa thấy đề."))
    if not opens_at or not closes_at:
        issues.append(_issue("warning", "no_schedule", "Chưa đặt đủ giờ mở và giờ đóng đề."))
    elif closes_at <= opens_at:
        issues.append(_issue("error", "invalid_schedule", "Giờ đóng đề phải sau giờ mở đề."))
    elif (closes_at - opens_at).total_seconds() < exam.duration_minutes * 60:
        issues.append(_issue("warning", "window_shorter_than_duration",
                             f"Khung giờ mở đề ngắn hơn thời gian làm bài ({exam.duration_minutes} phút): "
                             "thí sinh sẽ bị cắt giờ."))
    candidate_count = _assigned_candidate_count(exam)
    if candidate_count == 0:
        issues.append(_issue("warning", "no_candidates", "Chưa phân công thí sinh nào vào đề."))
    if exam.passing_score > 100:
        issues.append(_issue("error", "invalid_passing_score", "Điểm đạt (%) phải từ 0 đến 100."))
    if by_type.get(Question.Type.ESSAY):
        issues.append(_issue("info", "manual_grading",
                             f"Đề có {by_type[Question.Type.ESSAY]} câu tự luận, cần chấm tay sau khi thi."))

    stats.update(
        {
            "question_count": len(items),
            "manual_question_count": len(manual_items),
            "random_question_count": len(random_items),
            "total_points": str(total_points),
            "by_type": dict(by_type),
            "by_difficulty": dict(by_difficulty),
            "random_rules": rule_reports,
            "assigned_candidates": candidate_count,
            "duration_minutes": exam.duration_minutes,
            "opens_at": opens_at.isoformat() if opens_at else None,
            "closes_at": closes_at.isoformat() if closes_at else None,
        }
    )
    return _build_report(exam, issues, stats)


def _build_report(exam, issues, stats):
    counts = Counter(issue["level"] for issue in issues)
    return {
        "exam": {
            "id": exam.id,
            "name": exam.name,
            "status": exam.status,
            "subject": getattr(exam.subject, "name", ""),
        },
        "ready": counts.get("error", 0) == 0,
        "summary": {
            "errors": counts.get("error", 0),
            "warnings": counts.get("warning", 0),
            "info": counts.get("info", 0),
        },
        "issues": sorted(issues, key=lambda issue: {"error": 0, "warning": 1, "info": 2}[issue["level"]]),
        "stats": stats,
    }
