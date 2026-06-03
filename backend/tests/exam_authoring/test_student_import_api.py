import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


def _build_exam(*, subject, admin_user):
    from apps.exam_authoring.models import Exam

    return Exam.objects.create(
        name="Mathematics Final Exam",
        subject=subject,
        created_by=admin_user,
        updated_by=admin_user,
        duration_minutes=120,
        passing_score=60,
        max_attempts=1,
    )


@pytest.mark.django_db
def test_student_import_creates_user_and_assignment(api_client, admin_token, subject, admin_user):
    from apps.exam_authoring.models import ExamAssignment
    from apps.identity.models import UserRole
    from apps.institutions.models import School

    exam = _build_exam(subject=subject, admin_user=admin_user)
    school = School.objects.create(name="High School A", code="HSA")
    csv_content = (
        "full_name,date_of_birth,student_class,cccd,email,phone_number,school_code\n"
        "Lê Văn Bình,24/08/2003,12,012345678901,,0901234567,HSA\n"
    ).encode("utf-8")
    upload = SimpleUploadedFile("students.csv", csv_content, content_type="text/csv")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/exams/{exam.id}/student-import/", {"file": upload})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 1
    assert payload["created_users"] == 1
    assert payload["updated_users"] == 0
    assert payload["assigned_users"] == 1
    assert payload["failed_rows"] == 0

    assignment = ExamAssignment.objects.select_related("user__profile").get(exam=exam)
    assert assignment.user.username == "le.van.binh.24082003.12"
    assert assignment.user.email == "le.van.binh.24082003.12@student.local"
    assert assignment.user.profile.cccd == "012345678901"
    assert assignment.user.profile.student_class == "12"
    assert assignment.user.profile.phone_number == "0901234567"
    assert assignment.user.profile.school == school
    assert assignment.user.check_password("le.van.binh.24082003.12")
    assert UserRole.objects.filter(user=assignment.user, role__slug="candidate", is_active=True).exists()


@pytest.mark.django_db
def test_student_import_matches_existing_user_by_cccd_and_updates_fields(
    api_client,
    admin_token,
    subject,
    admin_user,
):
    from apps.exam_authoring.models import ExamAssignment
    from apps.identity.models import Profile
    from apps.institutions.models import School

    exam = _build_exam(subject=subject, admin_user=admin_user)
    old_school = School.objects.create(name="Old School", code="OLD")
    new_school = School.objects.create(name="New School", code="NEW")
    existing_user = admin_user.__class__.objects.create_user(
        username="existing.student",
        email="old@student.local",
        password="secret123",
        full_name="Old Name",
    )
    profile = Profile.objects.create(
        user=existing_user,
        phone_number="0900000000",
        cccd="999999999999",
        student_class="11A1",
        school=old_school,
    )

    csv_content = (
        "full_name,date_of_birth,student_class,cccd,email,phone_number,school_code\n"
        "New Student Name,24/08/2003,12A1,999999999999,new@student.local,0912345678,NEW\n"
    ).encode("utf-8")
    upload = SimpleUploadedFile("students.csv", csv_content, content_type="text/csv")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/exams/{exam.id}/student-import/", {"file": upload})

    assert response.status_code == 200
    payload = response.json()
    assert payload["created_users"] == 0
    assert payload["updated_users"] == 1
    assert payload["assigned_users"] == 1
    assert payload["failed_rows"] == 0

    existing_user.refresh_from_db()
    profile.refresh_from_db()
    assert existing_user.full_name == "New Student Name"
    assert existing_user.email == "new@student.local"
    assert existing_user.username == "existing.student"
    assert profile.phone_number == "0912345678"
    assert profile.student_class == "12A1"
    assert str(profile.date_of_birth) == "2003-08-24"
    assert profile.school == new_school
    assert ExamAssignment.objects.filter(exam=exam, user=existing_user).exists()


@pytest.mark.django_db
def test_student_import_returns_row_errors_without_duplicate_assignments(
    api_client,
    admin_token,
    subject,
    admin_user,
):
    from apps.exam_authoring.models import ExamAssignment
    from apps.identity.models import Profile

    exam = _build_exam(subject=subject, admin_user=admin_user)
    existing_user = admin_user.__class__.objects.create_user(
        username="assigned.student",
        email="assigned@student.local",
        password="secret123",
        full_name="Assigned Student",
    )
    Profile.objects.create(
        user=existing_user,
        cccd="123123123123",
        student_class="12",
    )
    ExamAssignment.objects.create(exam=exam, user=existing_user, assigned_by=admin_user)

    csv_content = (
        "full_name,date_of_birth,student_class,cccd,email,phone_number,school_code\n"
        "Assigned Student,24/08/2003,12,123123123123,,0901234567,\n"
        "Broken Student,24/08/2003,12,,,0901234567,\n"
    ).encode("utf-8")
    upload = SimpleUploadedFile("students.csv", csv_content, content_type="text/csv")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/exams/{exam.id}/student-import/", {"file": upload})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 2
    assert payload["created_users"] == 0
    assert payload["updated_users"] == 1
    assert payload["assigned_users"] == 0
    assert payload["failed_rows"] == 1
    assert len(payload["errors"]) == 1
    assert payload["errors"][0]["row_number"] == 3
    assert "cccd" in payload["errors"][0]["message"].lower()
    assert ExamAssignment.objects.filter(exam=exam, user=existing_user).count() == 1
