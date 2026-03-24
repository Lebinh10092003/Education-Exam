import pytest


@pytest.mark.django_db
def test_authenticated_admin_can_create_subject(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/subjects/",
        {
            "name": "Mathematics",
            "code": "MATH101",
            "description": "Advanced mathematical concepts",
            "color": "bg-blue-600",
            "is_active": True,
        },
        format="json",
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["code"] == "MATH101"
    assert payload["name"] == "Mathematics"


@pytest.mark.django_db
def test_authenticated_admin_can_create_subject_with_hex_color(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.post(
        "/api/v1/subjects/",
        {
            "name": "International Math Olympiad",
            "code": "IMO",
            "description": "Competition track",
            "color": "#2563EB",
            "is_active": True,
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["code"] == "IMO"
    assert payload["color"] == "#2563EB"
