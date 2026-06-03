import pytest


@pytest.mark.django_db
def test_admin_can_list_users_with_search_and_role_filter(
    api_client,
    admin_token,
    permission_grant,
):
    from django.contrib.auth import get_user_model

    user_model = get_user_model()
    examiner = user_model.objects.create_user(
        email="jane@example.com",
        password="secret123",
        full_name="Jane Examiner",
    )
    permission_grant(examiner, "groups.view", role_name="Examiner", role_slug="examiner")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get("/api/v1/users/?search=jane&role=examiner")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["email"] == "jane@example.com"


@pytest.mark.django_db
def test_admin_can_lock_and_unlock_user(
    api_client,
    admin_token,
    candidate_user,
):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    lock_response = api_client.post(f"/api/v1/users/{candidate_user.id}/lock/")
    assert lock_response.status_code == 200
    assert lock_response.json()["status"] == "locked"

    unlock_response = api_client.post(f"/api/v1/users/{candidate_user.id}/unlock/")
    assert unlock_response.status_code == 200
    assert unlock_response.json()["status"] == "active"


@pytest.mark.django_db
def test_admin_cannot_lock_their_own_account(
    api_client,
    admin_user,
    admin_token,
):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(f"/api/v1/users/{admin_user.id}/lock/")

    assert response.status_code == 400
    assert response.json()["detail"] == "Bạn không thể tự khóa tài khoản của mình."


@pytest.mark.django_db
def test_admin_cannot_delete_their_own_account(
    api_client,
    admin_user,
    admin_token,
):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.delete(f"/api/v1/users/{admin_user.id}/")

    assert response.status_code == 400
    assert response.json()["detail"] == "Bạn không thể tự xóa tài khoản của mình."


@pytest.mark.django_db
def test_admin_can_import_users_via_csv(api_client, admin_token):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.contrib.auth import get_user_model
    from apps.identity.models import Role

    # Create target roles so they can be matched
    Role.objects.create(slug="candidate", name="Candidate")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    csv_data = (
        "full_name,email,password,phone_number,status,is_active,is_staff,school_code,role_slugs\n"
        "Candidate New,newcand@example.com,pass123,+84900000001,active,true,false,,candidate\n"
    )
    uploaded_file = SimpleUploadedFile(
        "import.csv",
        csv_data.encode("utf-8"),
        content_type="text/csv",
    )

    response = api_client.post(
        "/api/v1/users/import-csv/",
        {"file": uploaded_file},
        format="multipart",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 1
    assert payload["created_users"] == 1
    assert payload["failed_rows"] == 0

    user_model = get_user_model()
    created_user = user_model.objects.filter(email="newcand@example.com").first()
    assert created_user is not None
    assert created_user.full_name == "Candidate New"
    assert created_user.user_roles.filter(role__slug="candidate", is_active=True).exists()


@pytest.mark.django_db
def test_admin_can_import_users_with_minimal_columns(api_client, admin_token):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.contrib.auth import get_user_model
    from apps.identity.models import Role

    # Create target role so it can be matched
    Role.objects.create(slug="candidate", name="Candidate")

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    # CSV data with only full_name and email
    csv_data = (
        "full_name,email\n"
        "Candidate Minimal,minimalcand@example.com\n"
    )
    uploaded_file = SimpleUploadedFile(
        "import_minimal.csv",
        csv_data.encode("utf-8"),
        content_type="text/csv",
    )

    response = api_client.post(
        "/api/v1/users/import-csv/",
        {"file": uploaded_file},
        format="multipart",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 1
    assert payload["created_users"] == 1
    assert payload["failed_rows"] == 0

    user_model = get_user_model()
    created_user = user_model.objects.filter(email="minimalcand@example.com").first()
    assert created_user is not None
    assert created_user.full_name == "Candidate Minimal"
    assert created_user.status == user_model.Status.ACTIVE
    assert created_user.is_active is True
    assert created_user.is_staff is False
    assert created_user.user_roles.filter(role__slug="candidate", is_active=True).exists()
