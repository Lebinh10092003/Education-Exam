import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


def _build_group():
    from apps.institutions.models import CandidateGroup, School

    school = School.objects.create(name="High School A", code="HSA")
    group = CandidateGroup.objects.create(name="Candidate Group A", school=school)
    return group, school


@pytest.mark.django_db
def test_group_membership_import_creates_candidate_and_membership(api_client, admin_token):
    from apps.identity.models import Profile, UserRole
    from apps.institutions.models import GroupMembership, School

    group, _ = _build_group()
    School.objects.create(name="High School B", code="HSB")
    csv_content = (
        "full_name,email,phone_number,student_class,cccd,date_of_birth,school_code\n"
        "Le Van Binh,,0901234567,12,012345678901,24/08/2003,HSB\n"
    ).encode("utf-8")
    upload = SimpleUploadedFile("members.csv", csv_content, content_type="text/csv")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/groups/{group.id}/memberships/import/", {"file": upload})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 1
    assert payload["created_users"] == 1
    assert payload["updated_users"] == 0
    assert payload["assigned_users"] == 1
    assert payload["failed_rows"] == 0

    membership = GroupMembership.objects.select_related("user__profile").get(group=group)
    profile = Profile.objects.get(user=membership.user)
    assert membership.is_active is True
    assert membership.user.full_name == "Le Van Binh"
    assert membership.user.email.endswith("@student.local")
    assert profile.cccd == "012345678901"
    assert profile.student_class == "12"
    assert profile.phone_number == "0901234567"
    assert profile.school.code == "HSB"
    assert UserRole.objects.filter(user=membership.user, role__slug__in=["candidate", "student"], is_active=True).exists()


@pytest.mark.django_db
def test_group_membership_import_returns_row_errors_without_aborting_the_batch(api_client, admin_token):
    from apps.institutions.models import GroupMembership

    group, _ = _build_group()
    csv_content = (
        "full_name,email,phone_number,student_class,cccd,date_of_birth,school_code\n"
        "Tran Thi Lan,tran.thi.lan@example.com,0912345678,11A1,,,\n"
        "Broken Member,,,12,,,\n"
    ).encode("utf-8")
    upload = SimpleUploadedFile("members.csv", csv_content, content_type="text/csv")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/groups/{group.id}/memberships/import/", {"file": upload})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 2
    assert payload["created_users"] == 1
    assert payload["assigned_users"] == 1
    assert payload["failed_rows"] == 1
    assert len(payload["errors"]) == 1
    assert payload["errors"][0]["row_number"] == 3
    assert "email" in payload["errors"][0]["message"].lower() or "cccd" in payload["errors"][0]["message"].lower()
    assert GroupMembership.objects.filter(group=group).count() == 1
