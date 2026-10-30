from datetime import timedelta

import pytest
from django.utils import timezone


def _question(subject, admin_user, text, **overrides):
    from apps.question_bank.services import create_question

    params = {
        "subject": subject,
        "created_by": admin_user,
        "difficulty": "easy",
        "question_type": "multiple_choice",
        "question_text": text,
        "options": [{"key": "A", "text": "1"}, {"key": "B", "text": "2"}],
        "correct_option_keys": ["A"],
    }
    params.update(overrides)
    return create_question(**params)


def _exam(subject, admin_user, **overrides):
    from apps.exam_authoring.services import create_exam

    now = timezone.now()
    params = {
        "name": "Đề kiểm tra",
        "subject": subject,
        "created_by": admin_user,
        "status": "scheduled",
        "duration_minutes": 45,
        "passing_score": 50,
        "opening_at": now + timedelta(days=1),
        "closing_at": now + timedelta(days=1, hours=2),
    }
    params.update(overrides)
    return create_exam(**params)


@pytest.mark.django_db
def test_quality_check_flags_random_pool_and_missing_candidates(api_client, admin_token, subject, admin_user):
    from apps.question_bank.models import Question

    manual = _question(subject, admin_user, "Câu cố định")
    hard = [_question(subject, admin_user, f"Câu khó {index}", difficulty="hard") for index in range(3)]
    exam = _exam(
        subject,
        admin_user,
        manual_question_ids=[manual.id],
        random_rules=[{"difficulty": "hard", "question_type": "multiple_choice", "tag_ids": [], "count": 3}],
    )
    # Sau khi tao de, ngan hang bi sua (doi do kho) -> luat ngau nhien khong con du cau.
    Question.objects.filter(id__in=[hard[0].id, hard[1].id]).update(difficulty="easy")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(f"/api/v1/exams/{exam.id}/quality-check/")

    assert response.status_code == 200
    report = response.json()
    codes = {issue["code"] for issue in report["issues"]}
    assert report["ready"] is False
    assert "random_pool_too_small" in codes
    assert "no_candidates" in codes
    assert report["stats"]["random_rules"][0] == {"sort_order": 1, "required": 3, "available": 1}


@pytest.mark.django_db
def test_quality_check_flags_short_window_and_essay_without_rubric(subject, admin_user):
    from apps.exam_authoring.quality import check_exam

    essay = _question(subject, admin_user, "Trình bày định lý", question_type="essay", options=[],
                      correct_option_keys=[])
    now = timezone.now()
    exam = _exam(subject, admin_user, manual_question_ids=[essay.id], duration_minutes=90,
                 opening_at=now, closing_at=now + timedelta(minutes=30))

    report = check_exam(exam)
    codes = {issue["code"] for issue in report["issues"]}

    assert "window_shorter_than_duration" in codes
    assert "missing_rubric" in codes
    assert "manual_grading" in codes
    assert report["stats"]["by_type"] == {"essay": 1}


@pytest.mark.django_db
def test_quality_check_passes_for_clean_exam(subject, admin_user, candidate_user):
    from apps.exam_authoring.quality import check_exam
    from apps.institutions.models import CandidateGroup, GroupMembership

    group = CandidateGroup.objects.create(name="Lớp 9A")
    GroupMembership.objects.create(group=group, user=candidate_user)
    questions = [_question(subject, admin_user, f"Câu số {index}") for index in range(3)]
    exam = _exam(subject, admin_user, manual_question_ids=[q.id for q in questions], group_ids=[group.id])

    report = check_exam(exam)

    assert report["ready"] is True
    assert report["summary"]["errors"] == 0
    assert report["stats"]["question_count"] == 3
    assert report["stats"]["assigned_candidates"] == 1
