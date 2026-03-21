import pytest
from django.db import IntegrityError


@pytest.mark.django_db
def test_exam_session_attempt_number_increments_per_candidate_and_exam(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.models import ExamSession
    from apps.institutions.models import CandidateGroup, GroupMembership, School

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1", school=school)
    GroupMembership.objects.create(group=group, user=candidate_user)
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=2,
        group_ids=[group.id],
    )
    ExamSession.objects.create(
        exam=exam,
        candidate=candidate_user,
        exam_version=exam.current_version,
        attempt_number=1,
        started_at="2026-03-21T08:00:00+07:00",
        expires_at="2026-03-21T10:00:00+07:00",
    )
    session = ExamSession.objects.create(
        exam=exam,
        candidate=candidate_user,
        exam_version=exam.current_version,
        attempt_number=2,
        started_at="2026-03-22T08:00:00+07:00",
        expires_at="2026-03-22T10:00:00+07:00",
    )

    assert session.attempt_number == 2


@pytest.mark.django_db
def test_submission_is_unique_per_session(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.models import ExamSession, Submission
    from apps.institutions.models import CandidateGroup, GroupMembership, School

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1", school=school)
    GroupMembership.objects.create(group=group, user=candidate_user)
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        group_ids=[group.id],
    )
    session = ExamSession.objects.create(
        exam=exam,
        candidate=candidate_user,
        exam_version=exam.current_version,
        attempt_number=1,
        started_at="2026-03-21T08:00:00+07:00",
        expires_at="2026-03-21T10:00:00+07:00",
    )

    Submission.objects.create(session=session, submitted_by=candidate_user)

    with pytest.raises(IntegrityError):
        Submission.objects.create(session=session, submitted_by=candidate_user)

