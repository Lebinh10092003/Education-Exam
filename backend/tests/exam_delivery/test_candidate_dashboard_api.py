from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone


def _build_candidate_exam(*, subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name=f"Dashboard School {candidate_user.id}", code=f"DS-{candidate_user.id}")
    group = CandidateGroup.objects.create(name=f"Dashboard Group {candidate_user.id}")
    GroupMembership.objects.create(group=group, user=candidate_user)
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
    now = timezone.now()
    return create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        opening_at=now + timedelta(days=1),
        closing_at=now + timedelta(days=2),
        manual_question_ids=[question.id],
        group_ids=[group.id],
    )


def _build_published_result(*, subject, admin_user, candidate_user):
    from apps.exam_authoring.services import create_exam, transition_exam_status
    from apps.exam_delivery.services import save_session_answer, start_or_resume_session, submit_session
    from apps.grading.services import publish_result
    from apps.institutions.models import CandidateGroup, GroupMembership, School
    from apps.question_bank.services import create_question

    school = School.objects.create(name=f"Published School {candidate_user.id}", code=f"PS-{candidate_user.id}")
    group = CandidateGroup.objects.create(name=f"Published Group {candidate_user.id}")
    GroupMembership.objects.create(group=group, user=candidate_user)
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
    now = timezone.now()
    exam = create_exam(
        name="Published Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        status="scheduled",
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        opening_at=now - timedelta(hours=1),
        closing_at=now + timedelta(hours=2),
        manual_question_ids=[question.id],
        group_ids=[group.id],
    )
    session = start_or_resume_session(exam=exam, candidate=candidate_user)
    session_question = session.questions.first()
    save_session_answer(
        session=session,
        session_question=session_question,
        selected_option_keys=["A"],
    )
    submit_session(session=session, submitted_by=candidate_user)
    transition_exam_status(exam=exam, next_status="closed", actor=admin_user)
    return publish_result(result=session.result, published_by=admin_user)


@pytest.mark.django_db
def test_candidate_can_load_dashboard_overview(api_client, candidate_user, subject, admin_user):
    from apps.academics.models import Subject
    from apps.materials.models import Material
    from rest_framework_simplejwt.tokens import RefreshToken

    _build_candidate_exam(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    _build_published_result(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    unassigned_subject = Subject.objects.create(
        name="Unassigned Physics",
        code="UNPHYS",
        description="Unassigned",
        color="bg-slate-600",
    )
    Material.objects.create(
        title="Calculus Fundamentals",
        description="Candidate handbook",
        subject=subject,
        file=SimpleUploadedFile("guide.txt", b"payload", content_type="text/plain"),
        file_name="guide.txt",
        file_size=7,
        mime_type="text/plain",
        uploaded_by=admin_user,
        is_active=True,
    )
    Material.objects.create(
        title="Physics Handbook",
        description="Should stay hidden",
        subject=unassigned_subject,
        file=SimpleUploadedFile("physics.txt", b"payload", content_type="text/plain"),
        file_name="physics.txt",
        file_size=7,
        mime_type="text/plain",
        uploaded_by=admin_user,
        is_active=True,
    )

    token = str(RefreshToken.for_user(candidate_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    response = api_client.get("/api/v1/my-dashboard/overview/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["stats"]["assigned_exam_count"] == 2
    assert payload["stats"]["upcoming_exam_count"] == 1
    assert payload["stats"]["published_result_count"] == 1
    assert payload["stats"]["active_material_count"] == 1
    assert {exam["name"] for exam in payload["upcoming_exams"]} == {"Mathematics Final Exam"}
    assert payload["upcoming_exams"][0]["lifecycle_phase"] == "scheduled"
    assert payload["recent_results"][0]["candidate"]["email"] == candidate_user.email
    assert payload["recent_materials"][0]["title"] == "Calculus Fundamentals"
