import pytest


@pytest.mark.django_db
def test_assignment_summary_returns_all_groups_with_assigned_flags(
    api_client,
    admin_token,
    admin_user,
    candidate_user,
    subject,
):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, GroupMembership, School

    school = School.objects.create(name="School A", code="SCHA")
    first_group = CandidateGroup.objects.create(name="Computer Science - Year 1", school=school)
    second_group = CandidateGroup.objects.create(name="Mathematics Advanced", school=school)
    GroupMembership.objects.create(group=first_group, user=candidate_user)
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        group_ids=[first_group.id],
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get(f"/api/v1/exams/{exam.id}/group-assignments/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 2
    assigned_group = next(group for group in payload["results"] if group["id"] == first_group.id)
    unassigned_group = next(group for group in payload["results"] if group["id"] == second_group.id)
    assert assigned_group["assigned"] is True
    assert assigned_group["member_count"] == 1
    assert unassigned_group["assigned"] is False


@pytest.mark.django_db
def test_assignment_sync_replaces_existing_group_assignments(
    api_client,
    admin_token,
    admin_user,
    subject,
):
    from apps.exam_authoring.services import create_exam
    from apps.institutions.models import CandidateGroup, School

    school = School.objects.create(name="School A", code="SCHA")
    first_group = CandidateGroup.objects.create(name="Computer Science - Year 1", school=school)
    second_group = CandidateGroup.objects.create(name="Mathematics Advanced", school=school)
    exam = create_exam(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
        group_ids=[first_group.id],
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(
        f"/api/v1/exams/{exam.id}/group-assignments/",
        {"group_ids": [second_group.id]},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assigned_group_ids"] == [second_group.id]
