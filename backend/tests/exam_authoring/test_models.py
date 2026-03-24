import pytest
from django.db import IntegrityError


@pytest.mark.django_db
def test_exam_version_numbers_increment_per_exam(subject, admin_user):
    from apps.exam_authoring.models import Exam, ExamVersion

    exam = Exam.objects.create(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        updated_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
    )
    ExamVersion.objects.create(exam=exam, version_number=1, created_by=admin_user)
    version = ExamVersion.objects.create(exam=exam, version_number=2, created_by=admin_user)

    assert version.version_number == 2


@pytest.mark.django_db
def test_exam_defaults_to_exam_mode(subject, admin_user):
    from apps.exam_authoring.models import Exam

    exam = Exam.objects.create(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        updated_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
    )

    assert exam.mode == Exam.Mode.EXAM


@pytest.mark.django_db
def test_exam_assignment_is_unique_per_exam_target(subject, admin_user):
    from apps.exam_authoring.models import Exam, ExamAssignment
    from apps.institutions.models import CandidateGroup, School

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1")
    exam = Exam.objects.create(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        updated_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
    )

    ExamAssignment.objects.create(exam=exam, group=group, assigned_by=admin_user)

    with pytest.raises(IntegrityError):
        ExamAssignment.objects.create(exam=exam, group=group, assigned_by=admin_user)

