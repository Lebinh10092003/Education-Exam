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


@pytest.mark.django_db
def test_authenticated_admin_can_delete_membership(
    api_client,
    admin_token,
    candidate_user,
):
    from apps.institutions.models import CandidateGroup, GroupMembership

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    group = CandidateGroup.objects.create(
        name="Test Group",
        description="Test Group Description",
        is_active=True,
    )
    membership = GroupMembership.objects.create(group=group, user=candidate_user, is_active=True)

    assert GroupMembership.objects.filter(group=group, user=candidate_user).exists()

    response = api_client.delete(
        f"/api/v1/groups/{group.id}/memberships/?user_id={candidate_user.id}"
    )
    assert response.status_code == 204

    assert not GroupMembership.objects.filter(group=group, user=candidate_user).exists()
