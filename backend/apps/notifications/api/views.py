from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasAPIPermissionCode

from ..models import Notification
from ..services import mark_all_notifications_as_read, mark_notification_as_read
from .serializers import (
    NotificationBulkActionSerializer,
    NotificationSerializer,
    NotificationUnreadCountSerializer,
)


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Notification.objects.none()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "notifications.view",
        "POST": "notifications.manage",
    }

    def _base_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by("is_read", "-created_at", "-id")

    def get_queryset(self):
        queryset = self._base_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(message__icontains=search))

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        is_read = self.request.query_params.get("is_read")
        if is_read in {"true", "false"}:
            queryset = queryset.filter(is_read=is_read == "true")

        priority = self.request.query_params.get("priority")
        if priority:
            queryset = queryset.filter(priority=priority)

        return queryset

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        payload = {
            "unread_count": self._base_queryset().filter(is_read=False).count(),
        }
        serializer = NotificationUnreadCountSerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = mark_notification_as_read(notification=self.get_object())
        output = self.get_serializer(notification)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated_count = mark_all_notifications_as_read(user=request.user)
        payload = {
            "updated_count": updated_count,
            "unread_count": self._base_queryset().filter(is_read=False).count(),
        }
        serializer = NotificationBulkActionSerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)
