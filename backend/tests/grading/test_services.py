from datetime import timedelta

import pytest
from django.utils import timezone


def _build_submitted_session(
    *,
    subject,
    admin_user,
    candidate_user,
    include_essay,
    show_results_immediately=False,
):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name=f"School {candidate_user.id}", code=f"SCH{candidate_user.id}")
    group = CandidateGroup.objects.create(name=f"Candidate Group {candidate_user.id}")
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
    question_ids = [objective_question.id]
    if include_essay:
        essay_question = create_question(
            subject=subject,
            created_by=admin_user,
            difficulty="medium",
            question_type="essay",
            question_text="Explain the binomial theorem.",
            tags=["Algebra"],
            essay_rubric="State formula and explain usage.",
        )
        question_ids.append(essay_question.id)

    now = timezone.now()
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        show_results_immediately=show_results_immediately,
        opening_at=now - timedelta(hours=1),
        closing_at=now + timedelta(hours=2),
        manual_question_ids=question_ids,
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    objective_session_question = session.questions.filter(question_revision__question__question_type="multiple_choice").first()
    save_session_answer(
        session=session,
        session_question=objective_session_question,
        selected_option_keys=["A"],
    )
    if include_essay:
        essay_session_question = session.questions.filter(question_revision__question__question_type="essay").first()
        save_session_answer(
            session=session,
            session_question=essay_session_question,
            answer_text="Use the formula (a+b)^n.",
        )
    submission = submit_session(session=session, submitted_by=candidate_user)
    session.refresh_from_db()
    return exam, session, submission


@pytest.mark.django_db
def test_initialize_grading_for_submission_creates_pending_tasks_for_essay_answers(
    subject,
    admin_user,
    candidate_user,
):
    _, session, _ = _build_submitted_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        include_essay=True,
    )

    assert session.manual_grading_tasks.count() == 1
    assert session.result.workflow_status == "pending_grading"
    assert session.result.publish_state == "draft"


@pytest.mark.django_db
def test_objective_only_submission_finalizes_result_without_manual_tasks(
    subject,
    admin_user,
    candidate_user,
):
    from apps.exam_authoring.services import transition_exam_status

    exam, session, _ = _build_submitted_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        include_essay=False,
        show_results_immediately=True,
    )
    transition_exam_status(exam=exam, next_status="closed", actor=admin_user)
    session.result.refresh_from_db()

    assert session.manual_grading_tasks.count() == 0
    assert session.result.workflow_status == "finalized"
    assert session.result.publish_state == "published"
    assert float(session.result.total_score) == 1.0


@pytest.mark.django_db
def test_grade_manual_task_updates_manual_score_and_finalizes_result_when_last_task_completed(
    subject,
    admin_user,
    candidate_user,
):
    from apps.grading.services import grade_manual_task

    _, session, _ = _build_submitted_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        include_essay=True,
    )
    task = session.manual_grading_tasks.first()

    grade_manual_task(task=task, grader=admin_user, score_awarded="1.00", feedback="Good explanation.")
    task.refresh_from_db()
    session.result.refresh_from_db()

    assert task.status == "graded"
    assert float(session.result.manual_score) == 1.0
    assert session.result.workflow_status == "finalized"


@pytest.mark.django_db
def test_publish_result_marks_result_as_published(subject, admin_user, candidate_user):
    from apps.exam_authoring.services import transition_exam_status
    from apps.grading.services import grade_manual_task, publish_result

    exam, session, _ = _build_submitted_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
        include_essay=True,
    )
    task = session.manual_grading_tasks.first()
    grade_manual_task(task=task, grader=admin_user, score_awarded="1.00")
    transition_exam_status(exam=exam, next_status="closed", actor=admin_user)

    publish_result(result=session.result, published_by=admin_user)
    session.result.refresh_from_db()

    assert session.result.publish_state == "published"
    assert session.result.published_by_id == admin_user.id
