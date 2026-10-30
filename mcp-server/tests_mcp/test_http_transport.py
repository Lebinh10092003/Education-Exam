"""MCP qua HTTP (nhu https://khaothi.fermat.vn/mcp): xac thuc bang ma truy cap ca nhan, goi tool that."""

import asyncio
import socket
import threading
import time

import httpx
import pytest
import uvicorn

from eduexam_mcp import core
from eduexam_mcp.client import EduExamClient


def _free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture
def http_server(transactional_db):
    from django.core.wsgi import get_wsgi_application

    from eduexam_mcp import server  # noqa: F401 (dang ky tool)
    from eduexam_mcp.http_app import build_http_app

    wsgi = get_wsgi_application()

    def factory(token):
        return EduExamClient("http://testserver", access_token=token, transport=httpx.WSGITransport(app=wsgi))

    app = build_http_app(allowed_hosts=["127.0.0.1:*"], client_factory=factory)
    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    uv = uvicorn.Server(config)
    thread = threading.Thread(target=uv.run, daemon=True)
    thread.start()
    for _ in range(100):
        if uv.started:
            break
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    uv.should_exit = True
    thread.join(timeout=5)
    core.disable_http_mode()


def _pat(user):
    from apps.identity.api_tokens import create_api_token

    return create_api_token(user=user, name="test")[1]


async def _call_tools(base_url, token):
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(f"{base_url}/mcp", headers={"Authorization": f"Bearer {token}"}) as (
        read,
        write,
        _,
    ):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            who = await session.call_tool("whoami", {})
            return len(tools.tools), who


def test_remote_mcp_uses_callers_own_token(http_server, admin_user):
    token = _pat(admin_user)

    tool_count, who = asyncio.run(_call_tools(http_server, token))

    assert tool_count >= 100
    assert not who.isError
    assert admin_user.email in who.content[0].text


def test_remote_mcp_rejects_missing_wrong_or_revoked_tokens(http_server, admin_user):
    from apps.identity.api_tokens import create_api_token, revoke_api_token

    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
    headers = {"Accept": "application/json, text/event-stream"}

    assert httpx.post(f"{http_server}/mcp", json=body, headers=headers).status_code == 401
    wrong = {**headers, "Authorization": "Bearer eduexam_pat_sai"}
    assert httpx.post(f"{http_server}/mcp", json=body, headers=wrong).status_code == 401

    record, raw = create_api_token(user=admin_user, name="sẽ thu hồi")
    revoke_api_token(record)
    revoked = {**headers, "Authorization": f"Bearer {raw}"}
    assert httpx.post(f"{http_server}/mcp", json=body, headers=revoked).status_code == 401

    assert httpx.get(f"{http_server}/healthz").json() == {"status": "ok"}


def test_remote_mcp_blocks_unknown_host_header(http_server, admin_user):
    token = _pat(admin_user)
    response = httpx.post(
        f"{http_server}/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json, text/event-stream",
            "Host": "evil.example.com",
        },
    )
    assert response.status_code in {400, 403, 421}


def test_backend_down_returns_503_and_is_not_cached():
    import anyio

    from eduexam_mcp.http_app import BackendUnavailable, TokenAuthMiddleware

    calls = {"n": 0}

    def flaky(token):
        calls["n"] += 1
        if calls["n"] == 1:
            raise BackendUnavailable("down")
        return True

    sent = []

    async def app(scope, receive, send):
        sent.append("app")

    async def send(message):
        if message["type"] == "http.response.start":
            sent.append(message["status"])

    middleware = TokenAuthMiddleware(app, mcp_path="/mcp", validate=flaky)
    scope = {"type": "http", "path": "/mcp", "headers": [(b"authorization", b"Bearer eduexam_pat_abc")]}

    anyio.run(middleware, scope, None, send)
    anyio.run(middleware, scope, None, send)
    assert sent == [503, "app"]
