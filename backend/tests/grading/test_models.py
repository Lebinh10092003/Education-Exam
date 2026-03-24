import pytest
from django.db import IntegrityError


@pytest.mark.django_db
def test_manual_grading_task_is_unique_per_session_question(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import start_or_resume_session
    from apps.grading.models import ManualGradingTask
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1")
    GroupMembership.objects.create(group=group, user=candidate_user)
    essay_question = create_question(
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
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        manual_question_ids=[essay_question.id],
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    session_question = session.questions.first()

    ManualGradingTask.objects.create(
        session=session,
        session_question=session_question,
        max_points=session_question.points,
    )

    with pytest.raises(IntegrityError):
        ManualGradingTask.objects.create(
            session=session,
            session_question=session_question,
            max_points=session_question.points,
        )


@pytest.mark.django_db
def test_result_is_unique_per_session(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import start_or_resume_session
    from apps.grading.models import Result
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name="School A", code="SCHA")
    group = CandidateGroup.objects.create(name="Computer Science - Year 1")
    GroupMembership.objects.create(group=group, user=candidate_user)
    objective_question = create_question(
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
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        manual_question_ids=[objective_question.id],
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)

    Result.objects.create(
        session=session,
        workflow_status="finalized",
        publish_state="draft",
        objective_score="1.00",
        manual_score="0.00",
        total_score="1.00",
        max_score="1.00",
        percentage="100.00",
        passed=True,
    )

    with pytest.raises(IntegrityError):
        Result.objects.create(
            session=session,
            workflow_status="finalized",
            publish_state="draft",
            objective_score="1.00",
            manual_score="0.00",
            total_score="1.00",
            max_score="1.00",
            percentage="100.00",
            passed=True,
        )

