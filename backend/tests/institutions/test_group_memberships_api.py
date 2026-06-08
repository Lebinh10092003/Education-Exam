from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
import pytest


@pytest.mark.django_db
def test_group_memberships_return_full_roster_fields(api_client, admin_token, candidate_user):
    from apps.identity.models import Profile
    from apps.institutions.models import CandidateGroup, GroupMembership, School

    school = School.objects.create(name="Fermat School", code="FERMAT")
    profile, _ = Profile.objects.get_or_create(user=candidate_user)
    profile.date_of_birth = "2003-08-24"
    profile.school = school
    profile.phone_number = "0901234567"
    profile.student_class = "12"
    profile.ward = "Phuong 1"
    profile.national_exam_subject = "Toan"
    profile.exam_block = "A00"
    profile.candidate_number = "IMO001"
    profile.visible_password = "candidate-pass"
    profile.save()
    group = CandidateGroup.objects.create(name="IMO Group")
    GroupMembership.objects.create(group=group, user=candidate_user)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get(f"/api/v1/groups/{group.id}/memberships/")

    assert response.status_code == 200
    member = response.json()["results"][0]
    assert member["full_name"] == candidate_user.full_name
    assert member["username"] == candidate_user.username
    assert member["date_of_birth"] == "2003-08-24"
    assert member["school"] == {"id": school.id, "name": "Fermat School", "code": "FERMAT"}
    assert member["phone_number"] == "0901234567"
    assert member["student_class"] == "12"
    assert member["ward"] == "Phuong 1"
    assert member["national_exam_subject"] == "Toan"
    assert member["exam_block"] == "A00"
    assert member["candidate_number"] == "IMO001"
    assert member["visible_password"] == "candidate-pass"


@pytest.mark.django_db
def test_group_membership_import_stores_roster_fields_and_visible_password(api_client, admin_token):
    from apps.identity.models import Profile
    from apps.institutions.models import CandidateGroup, GroupMembership, School

    school = School.objects.create(name="Fermat School", code="FERMAT")
    group = CandidateGroup.objects.create(name="IMO Group")
    csv_content = (
        "full_name,username,password,email,phone_number,date_of_birth,school_code,ward,"
        "national_exam_subject,exam_block,candidate_number\n"
        "Le Van Binh,imo001,imo-pass,imo001@example.com,0901234567,24/08/2003,FERMAT,"
        "Phuong 1,Toan,A00,IMO001\n"
    ).encode("utf-8")
    upload = SimpleUploadedFile("members.csv", csv_content, content_type="text/csv")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(
        f"/api/v1/groups/{group.id}/memberships/import/",
        {"file": upload},
    )

    assert response.status_code == 200
    assert response.json()["created_users"] == 1
    user = get_user_model().objects.get(username="imo001")
    assert user.check_password("imo-pass")
    assert GroupMembership.objects.filter(group=group, user=user).exists()
    profile = Profile.objects.get(user=user)
    assert profile.school == school
    assert profile.phone_number == "0901234567"
    assert profile.date_of_birth.isoformat() == "2003-08-24"
    assert profile.ward == "Phuong 1"
    assert profile.national_exam_subject == "Toan"
    assert profile.exam_block == "A00"
    assert profile.candidate_number == "IMO001"
    assert profile.visible_password == "imo-pass"


@pytest.mark.django_db
def test_user_api_saves_visible_password_when_admin_sets_password(api_client, admin_token):
    from apps.identity.models import Profile

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    create_response = api_client.post(
        "/api/v1/users/",
        {
            "full_name": "New Candidate",
            "email": "new-candidate@example.com",
            "password": "initial-pass",
            "ward": "Phuong 2",
            "national_exam_subject": "Toan",
            "exam_block": "A01",
            "candidate_number": "IMO002",
            "status": "active",
            "is_active": True,
            "is_staff": False,
        },
        format="json",
    )

    assert create_response.status_code == 201
    user = get_user_model().objects.get(email="new-candidate@example.com")
    profile = Profile.objects.get(user=user)
    assert profile.visible_password == "initial-pass"
    assert profile.ward == "Phuong 2"

    patch_response = api_client.patch(
        f"/api/v1/users/{user.id}/",
        {"password": "reset-pass"},
        format="json",
    )

    assert patch_response.status_code == 200
    user.refresh_from_db()
    profile.refresh_from_db()
    assert user.check_password("reset-pass")
    assert profile.visible_password == "reset-pass"
