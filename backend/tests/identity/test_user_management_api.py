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
