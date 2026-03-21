from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import PermissionDenied

from .services import assert_admin_monitoring_access, build_exam_monitoring_snapshot, monitoring_group_name


@database_sync_to_async
def _load_monitoring_snapshot(user, exam_id):
    from apps.exam_authoring.models import Exam

    assert_admin_monitoring_access(user=user)
    exam = Exam.objects.select_related("subject", "current_version").get(pk=exam_id)
    return build_exam_monitoring_snapshot(exam=exam)


class MonitoringConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.exam_id = int(self.scope["url_route"]["kwargs"]["exam_id"])
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        try:
            snapshot = await _load_monitoring_snapshot(user, self.exam_id)
        except (PermissionDenied, ObjectDoesNotExist):
            await self.close(code=4403)
            return

        self.group_name = monitoring_group_name(self.exam_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "snapshot", "payload": snapshot})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def monitoring_message(self, event):
        await self.send_json(
            {
                "type": event["message_type"],
                "payload": event["payload"],
            }
        )
