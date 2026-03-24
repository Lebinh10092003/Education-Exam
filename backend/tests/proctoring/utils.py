from datetime import timedelta

from django.utils import timezone


def build_active_session(*, subject, admin_user, candidate_user, exam_name=None):
    from apps.exam_authoring.services import create_exam
    from apps.exam_delivery.services import start_or_resume_session
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(
        name=f"School {candidate_user.id}",
        code=f"PROCTSCH{candidate_user.id}",
    )
    group = CandidateGroup.objects.create(
        name=f"Proctoring Group {candidate_user.id}",
    )
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
    now = timezone.now()
    exam = create_exam(
        name=exam_name or f"Mathematics Final Exam {candidate_user.id}",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        opening_at=now - timedelta(hours=1),
        closing_at=now + timedelta(hours=2),
        manual_question_ids=[objective_question.id],
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    return exam, session

