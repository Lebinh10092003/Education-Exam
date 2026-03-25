import pytest


@pytest.mark.django_db
def test_dashboard_overview_returns_expected_payload(
    api_client,
    admin_token,
    admin_user,
    candidate_user,
    subject,
):
    from apps.exam_authoring.models import Exam, ExamAssignment, ExamItem, ExamScheduleWindow, ExamVersion
    from apps.exam_delivery.models import ExamSession
    from apps.identity.models import Role, UserRole
    from apps.proctoring.services import record_proctor_event
    from apps.question_bank.models import Question, QuestionAnswerKey, QuestionRevision
    from django.utils import timezone

    candidate_role, _ = Role.objects.get_or_create(slug="candidate", defaults={"name": "Candidate"})
    UserRole.objects.get_or_create(user=candidate_user, role=candidate_role)

    question = Question.objects.create(
        subject=subject,
        question_type=Question.Type.MULTIPLE_CHOICE,
        difficulty=Question.Difficulty.EASY,
        created_by=admin_user,
        updated_by=admin_user,
    )
    revision = QuestionRevision.objects.create(
        question=question,
        revision_number=1,
        question_text="What is 2 + 2?",
        created_by=admin_user,
    )
    question.current_revision = revision
    question.save(update_fields=["current_revision", "updated_at"])
    QuestionAnswerKey.objects.create(revision=revision, correct_option_keys=["A"])

    exam = Exam.objects.create(
        name="Dashboard Exam",
        subject=subject,
        status=Exam.Status.OPEN,
        enable_proctoring=True,
        duration_minutes=60,
        passing_score=60,
        max_attempts=1,
        created_by=admin_user,
        updated_by=admin_user,
    )
    version = ExamVersion.objects.create(exam=exam, version_number=1, created_by=admin_user)
    ExamItem.objects.create(
        version=version,
        question_revision=revision,
        sort_order=1,
        points=1,
        source=ExamItem.Source.MANUAL,
    )
    exam.current_version = version
    exam.save(update_fields=["current_version", "updated_at"])
    ExamScheduleWindow.objects.create(
        exam=exam,
        opens_at=timezone.now(),
        closes_at=timezone.now() + timezone.timedelta(hours=2),
    )
    ExamAssignment.objects.create(exam=exam, user=candidate_user, assigned_by=admin_user)

    session = ExamSession.objects.create(
        exam=exam,
        candidate=candidate_user,
        exam_version=version,
        status=ExamSession.Status.SUBMITTED,
        attempt_number=1,
        started_at=timezone.now() - timezone.timedelta(minutes=20),
        expires_at=timezone.now() + timezone.timedelta(minutes=40),
        submitted_at=timezone.now(),
    )
    record_proctor_event(
        session=session,
        event_type="tab_switch",
        severity="warning",
        metadata={"message": "Candidate changed tab"},
        reported_by=candidate_user,
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/dashboard/overview/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_candidates"] == 1
    assert payload["active_exams"] == 1
    assert payload["question_bank_count"] >= 1
    assert payload["recent_exams"][0]["name"] == "Dashboard Exam"
    assert payload["alerts"][0]["message"] == "Candidate changed tab"
