import pytest


@pytest.mark.django_db
def test_audit_list_endpoint_returns_events(api_client, admin_token, admin_user):
    from apps.platform_core.audit import record_audit_event

    record_audit_event(
        actor=admin_user,
        action="user.login",
        category="authentication",
        description="User logged in successfully.",
        metadata={"source": "password"},
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/audit/events/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["action"] == "user.login"
    assert payload["results"][0]["category"] == "authentication"


@pytest.mark.django_db
def test_lock_user_action_creates_audit_event(api_client, admin_token, user):
    from apps.platform_core.models import AuditEvent

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/users/{user.id}/lock/")

    assert response.status_code == 200
    event = AuditEvent.objects.filter(action="user.locked").first()
    assert event is not None
    assert event.category == "security"
    assert event.metadata["target_user_id"] == user.id
