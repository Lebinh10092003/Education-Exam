from django.utils import timezone

from apps.identity.models import User

from .models import Notification


def create_notification(
    *,
    recipient,
    title,
    message="",
    category=Notification.Category.SYSTEM,
    priority=Notification.Priority.MEDIUM,
    action_url="",
    metadata=None,
):
    return Notification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        category=category,
        priority=priority,
        action_url=action_url,
        metadata=metadata or {},
    )


def mark_notification_as_read(*, notification):
    if notification.is_read:
        return notification
    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save(update_fields=["is_read", "read_at", "updated_at"])
    return notification


def mark_all_notifications_as_read(*, user):
    now = timezone.now()
    updated_count = (
        Notification.objects.filter(recipient=user, is_read=False).update(
            is_read=True,
            read_at=now,
            updated_at=now,
        )
    )
    return updated_count


def users_with_permission(*, permission_code, exclude_user_ids=None):
    exclude_ids = [user_id for user_id in (exclude_user_ids or []) if user_id is not None]
    queryset = (
        User.objects.filter(
            is_active=True,
            user_roles__is_active=True,
            user_roles__role__is_active=True,
            user_roles__role__permissions__code=permission_code,
        )
        .exclude(status=User.Status.LOCKED)
        .distinct()
    )
    if exclude_ids:
        queryset = queryset.exclude(id__in=exclude_ids)
    return queryset.order_by("email")


def create_notifications_for_users(
    *,
    recipients,
    title,
    message="",
    category=Notification.Category.SYSTEM,
    priority=Notification.Priority.MEDIUM,
    action_url="",
    metadata=None,
):
    payload = metadata or {}
    notifications = [
        Notification(
            recipient=recipient,
            title=title,
            message=message,
            category=category,
            priority=priority,
            action_url=action_url,
            metadata=payload,
        )
        for recipient in recipients
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)
    return len(notifications)


def create_notifications_for_permission(
    *,
    permission_code,
    title,
    message="",
    category=Notification.Category.SYSTEM,
    priority=Notification.Priority.MEDIUM,
    action_url="",
    metadata=None,
    exclude_user_ids=None,
):
    recipients = users_with_permission(
        permission_code=permission_code,
        exclude_user_ids=exclude_user_ids,
    )
    return create_notifications_for_users(
        recipients=recipients,
        title=title,
        message=message,
        category=category,
        priority=priority,
        action_url=action_url,
        metadata=metadata,
    )
