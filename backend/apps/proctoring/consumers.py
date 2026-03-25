from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import PermissionDenied

from .services import (
    assert_admin_monitoring_access,
    assert_candidate_session_access,
    build_exam_monitoring_snapshot,
    monitoring_group_name,
    session_control_group_name,
)


@database_sync_to_async
def _load_monitoring_snapshot(user, exam_id):
    from apps.exam_authoring.models import Exam

    assert_admin_monitoring_access(user=user)
    exam = Exam.objects.select_related("subject", "current_version").get(pk=exam_id)
    return build_exam_monitoring_snapshot(exam=exam)


@database_sync_to_async
def _load_candidate_control_snapshot(user, session_id):
    from apps.exam_delivery.models import ExamSession
    from apps.exam_authoring.lifecycle import resolve_exam_phase
    from apps.proctoring.runtime import get_runtime_snapshot

    session = ExamSession.objects.select_related("candidate", "exam", "exam__schedule_window").get(pk=session_id)
    assert_candidate_session_access(session=session, user=user)
    return {
        "runtime": get_runtime_snapshot(session_id=session.id),
        "phase": resolve_exam_phase(session.exam),
    }


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


class CandidateSessionControlConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = int(self.scope["url_route"]["kwargs"]["session_id"])
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        try:
            runtime_snapshot = await _load_candidate_control_snapshot(user, self.session_id)
        except (PermissionDenied, ObjectDoesNotExist):
            await self.close(code=4403)
            return

        self.group_name = session_control_group_name(self.session_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json(
            {
                "type": "live_request",
                "payload": runtime_snapshot["runtime"].get(
                    "live_request",
                    {"enabled": False, "state": "disabled"},
                ),
            }
        )
        await self.send_json(
            {
                "type": "session_phase",
                "payload": {"phase": runtime_snapshot["phase"]},
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def control_message(self, event):
        await self.send_json(
            {
                "type": event["message_type"],
                "payload": event["payload"],
            }
        )
