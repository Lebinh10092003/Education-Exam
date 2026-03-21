import pytest


@pytest.mark.django_db
def test_school_list_requires_authentication(client):
    response = client.get("/api/v1/schools/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_authenticated_admin_can_create_group_and_membership(
    api_client,
    admin_token,
    candidate_user,
):
    from apps.institutions.models import School

    school = School.objects.create(name="School A", code="SCHA")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    create_response = api_client.post(
        "/api/v1/groups/",
        {
            "name": "Computer Science - Year 1",
            "description": "First year computer science students",
            "school_id": school.id,
            "is_active": True,
        },
        format="json",
    )
    assert create_response.status_code == 201

    group_id = create_response.json()["id"]

    membership_response = api_client.post(
        f"/api/v1/groups/{group_id}/memberships/",
        {
            "user_id": candidate_user.id,
            "is_active": True,
        },
        format="json",
    )
    assert membership_response.status_code == 201

    list_response = api_client.get(f"/api/v1/groups/{group_id}/memberships/")
    assert list_response.status_code == 200
    assert list_response.json()["count"] == 1
