import pytest


@pytest.mark.django_db
def test_create_exam_builds_current_version_schedule_and_assignments(subject, admin_user):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1")
    question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        correct_option_keys=["A"],
    )

    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        description="Semester final",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        shuffle_questions=True,
        show_results_immediately=False,
        enable_proctoring=True,
        opening_at="2026-03-22T08:00:00+07:00",
        closing_at="2026-03-22T12:00:00+07:00",
        manual_question_ids=[question.id],
        group_ids=[group.id],
        user_ids=[admin_user.id],
    )

    assert exam.current_version.version_number == 1
    assert exam.current_version.items.count() == 1
    assert exam.assignments.count() == 2
    assert exam.schedule_window.opens_at is not None


@pytest.mark.django_db
def test_update_exam_creates_new_version_without_mutating_old_items(subject, admin_user):
    from apps.exam_authoring.services import create_exam, revise_exam
    from apps.question_bank.services import create_question

    first_question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        correct_option_keys=["A"],
    )
    second_question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="medium",
        question_type="essay",
        question_text="Explain the binomial theorem.",
        tags=["Algebra"],
        essay_rubric="State formula and explain usage.",
    )
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        description="Semester final",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        manual_question_ids=[first_question.id, second_question.id],
    )
    old_version = exam.current_version

    updated = revise_exam(
        exam=exam,
        updated_by=admin_user,
        name="Mathematics Final Exam v2",
        manual_question_ids=[second_question.id],
    )

    assert updated.name == "Mathematics Final Exam v2"
    assert updated.current_version.version_number == 2
    assert updated.current_version_id != old_version.id
    assert old_version.items.count() == 2
    assert updated.current_version.items.count() == 1


@pytest.mark.django_db
def test_clone_exam_copies_current_version_and_assignments(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import clone_exam, create_exam
    from apps.institutions.models import CandidateGroup, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1")
    question = create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text="What is the derivative of x squared?",
        tags=["Calculus"],
        options=[{"key": "A", "text": "2x"}, {"key": "B", "text": "x"}],
        correct_option_keys=["A"],
    )
    source_exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        description="Semester final",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        manual_question_ids=[question.id],
        group_ids=[group.id],
        user_ids=[candidate_user.id],
    )

    cloned = clone_exam(exam=source_exam, created_by=admin_user)

    assert cloned.id != source_exam.id
    assert cloned.current_version.items.count() == source_exam.current_version.items.count()
    assert cloned.assignments.count() == source_exam.assignments.count()

