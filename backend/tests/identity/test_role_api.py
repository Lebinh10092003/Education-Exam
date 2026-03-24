import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_seed_command_creates_system_roles_and_permissions():
    from apps.identity.models import Permission, Role

    call_command("seed_demo_data")

    assert Role.objects.filter(slug="administrator").exists()
    assert Permission.objects.filter(code="users.manage").exists()


@pytest.mark.django_db
def test_role_list_endpoint_returns_permissions(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get("/api/v1/roles/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] >= 1
    assert "is_active" in payload["results"][0]
    assert "permissions" in payload["results"][0]


@pytest.mark.django_db
def test_seed_command_creates_permission_modules_for_updated_ui():
    from apps.identity.models import Permission

    call_command("seed_demo_data")

    for code in (
        "notifications.view",
        "notifications.manage",
        "audit.view",
        "audit.manage",
    ):
        assert Permission.objects.filter(code=code).exists()
