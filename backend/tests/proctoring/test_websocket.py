import asyncio

import pytest
from asgiref.sync import sync_to_async
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application

from .utils import build_active_session
from .websocket_communicator import WebsocketCommunicator


@pytest.mark.django_db(transaction=True)
def test_monitoring_consumer_rejects_invalid_token():
    async def scenario():
        communicator = WebsocketCommunicator(application, "/ws/monitoring/exams/999/?token=bad-token")
        connected, _ = await communicator.connect()
        assert connected is False

    asyncio.run(scenario())


@pytest.mark.django_db(transaction=True)
def test_monitoring_consumer_receives_event_broadcast_for_exam(subject, admin_user, candidate_user, fake_redis):
    from apps.proctoring.services import record_proctor_event

    exam, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    token = str(RefreshToken.for_user(admin_user).access_token)

    async def scenario():
        communicator = WebsocketCommunicator(
            application,
            f"/ws/monitoring/exams/{exam.id}/?token={token}",
        )
        connected, _ = await communicator.connect()
        assert connected is True

        initial_message = await communicator.receive_json_from()
        assert initial_message["type"] == "snapshot"

        await sync_to_async(record_proctor_event)(
            session=session,
            event_type="tab_switch",
            severity="warning",
            metadata={"count": 1},
            reported_by=candidate_user,
        )
        broadcast_message = await communicator.receive_json_from()
        assert broadcast_message["type"] == "proctor_event"
        assert broadcast_message["payload"]["event_type"] == "tab_switch"
        await communicator.disconnect()

    asyncio.run(scenario())


@pytest.mark.django_db(transaction=True)
def test_candidate_control_consumer_receives_live_request_updates(subject, admin_user, candidate_user, fake_redis):
    from apps.proctoring.services import issue_admin_view_token

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    candidate_token = str(RefreshToken.for_user(candidate_user).access_token)

    async def scenario():
        communicator = WebsocketCommunicator(
            application,
            f"/ws/proctoring/sessions/{session.id}/control/?token={candidate_token}",
        )
        connected, _ = await communicator.connect()
        assert connected is True

        initial_message = await communicator.receive_json_from()
        assert initial_message["type"] == "live_request"
        assert initial_message["payload"]["enabled"] is False

        await sync_to_async(issue_admin_view_token)(
            session=session,
            user=admin_user,
        )
        broadcast_message = await communicator.receive_json_from()
        assert broadcast_message["type"] == "live_request"
        assert broadcast_message["payload"]["enabled"] is True
        await communicator.disconnect()

    asyncio.run(scenario())
