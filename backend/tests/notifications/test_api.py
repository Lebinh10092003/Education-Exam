import pytest


@pytest.mark.django_db
def test_admin_can_list_notifications(api_client, admin_token, admin_user, candidate_user):
    from apps.notifications.services import create_notification

    create_notification(
        recipient=admin_user,
        title="Exam starting soon",
        message="Mathematics Final Exam starts in 30 minutes.",
        category="exam",
        priority="high",
    )
    create_notification(
        recipient=admin_user,
        title="New submission",
        message="A new answer requires manual grading.",
        category="grading",
        priority="medium",
    )
    create_notification(
        recipient=candidate_user,
        title="Other user notification",
        message="Should not be visible to the admin inbox.",
        category="system",
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/notifications/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 2
    assert {item["title"] for item in payload["results"]} == {
        "Exam starting soon",
        "New submission",
    }


@pytest.mark.django_db
def test_admin_can_mark_notification_as_read(api_client, admin_token, admin_user):
    from apps.notifications.models import Notification
    from apps.notifications.services import create_notification

    notification = create_notification(
        recipient=admin_user,
        title="Pending grading task",
        message="One response is waiting for manual review.",
        category=Notification.Category.GRADING,
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post(f"/api/v1/notifications/{notification.id}/mark-read/")

    assert response.status_code == 200
    notification.refresh_from_db()
    assert notification.is_read is True
    assert notification.read_at is not None
    assert response.json()["is_read"] is True


@pytest.mark.django_db
def test_notification_unread_count_endpoint_returns_total(api_client, admin_token, admin_user):
    from apps.notifications.models import Notification
    from apps.notifications.services import create_notification, mark_notification_as_read

    unread = create_notification(
        recipient=admin_user,
        title="Exam completed",
        message="Chemistry practice exam has ended.",
        category=Notification.Category.EXAM,
    )
    read = create_notification(
        recipient=admin_user,
        title="System update",
        message="Maintenance window completed successfully.",
        category=Notification.Category.SYSTEM,
    )
    mark_notification_as_read(notification=read)

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/notifications/unread-count/")

    assert response.status_code == 200
    assert response.json()["unread_count"] == 1
    unread.refresh_from_db()
    assert unread.is_read is False
