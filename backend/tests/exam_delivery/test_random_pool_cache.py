from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone


def _build_random_exam(*, subject, admin_user, candidates):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, GroupMembership
    from apps.question_bank.services import create_question

    group = CandidateGroup.objects.create(name="Random Pool Group")
    for candidate in candidates:
        GroupMembership.objects.create(group=group, user=candidate)
    manual = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="Manual",
        options=[{"key": "A", "text": "A"}],
        correct_option_keys=["A"],
    )
    for index in range(8):
        create_question(
            subject=subject,
            created_by=admin_user,
            difficulty="easy",
            question_type="multiple_choice",
            question_text=f"Pool {index}",
            options=[{"key": "A", "text": "A"}],
            correct_option_keys=["A"],
        )
    now = timezone.now()
    return create_exam(
        name="Random Pool Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=60,
        passing_score=50,
        opening_at=now - timedelta(hours=1),
        closing_at=now + timedelta(hours=2),
        manual_question_ids=[manual.id],
        random_rules=[{"difficulty": "easy", "question_type": "multiple_choice", "tag_ids": [], "count": 3}],
        group_ids=[group.id],
    )


def _revision_ids(session):
    return list(session.questions.order_by("sort_order").values_list("question_revision_id", flat=True))


@pytest.mark.django_db
def test_cached_pool_produces_same_questions_as_uncached(settings, subject, admin_user, candidate_user):
    from apps.exam_delivery.models import ExamSession
    from apps.exam_delivery.services import start_or_resume_session

    exam = _build_random_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user])

    settings.EXAM_RANDOM_POOL_CACHE_TTL_SECONDS = 0
    uncached = _revision_ids(start_or_resume_session(exam=exam, candidate=candidate_user))
    ExamSession.objects.filter(exam=exam, candidate=candidate_user).delete()

    cache.clear()
    settings.EXAM_RANDOM_POOL_CACHE_TTL_SECONDS = 60
    cached_first = _revision_ids(start_or_resume_session(exam=exam, candidate=candidate_user))
    ExamSession.objects.filter(exam=exam, candidate=candidate_user).delete()
    cached_second = _revision_ids(start_or_resume_session(exam=exam, candidate=candidate_user))
    cache.clear()

    assert len(uncached) == 4
    assert uncached == cached_first == cached_second


@pytest.mark.django_db
def test_pool_is_queried_once_per_ttl(settings, subject, admin_user, candidate_user, django_assert_num_queries):
    from apps.exam_delivery.models import ExamSession
    from apps.exam_delivery.services import _random_rule_candidate_pool, start_or_resume_session

    exam = _build_random_exam(subject=subject, admin_user=admin_user, candidates=[candidate_user])
    cache.clear()
    settings.EXAM_RANDOM_POOL_CACHE_TTL_SECONDS = 60
    session = ExamSession.objects.select_related("exam").get(
        pk=start_or_resume_session(exam=exam, candidate=candidate_user).pk
    )
    rule = session.exam_version.random_rules.get()

    with django_assert_num_queries(0):
        pool = _random_rule_candidate_pool(session=session, rule=rule)

    assert len(pool) == 9
    assert pool == sorted(pool)
    cache.clear()
