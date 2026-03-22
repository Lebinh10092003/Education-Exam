from rest_framework import serializers

from ..models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "title",
            "message",
            "category",
            "priority",
            "action_url",
            "metadata",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class NotificationUnreadCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()


class NotificationBulkActionSerializer(serializers.Serializer):
    updated_count = serializers.IntegerField()
    unread_count = serializers.IntegerField()
