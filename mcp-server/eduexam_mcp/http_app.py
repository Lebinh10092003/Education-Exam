"""
Chay MCP qua HTTP (Streamable HTTP) de ket noi bang link, vd. https://khaothi.fermat.vn/mcp

Bao mat:
- Moi request phai co "Authorization: Bearer eduexam_pat_..." (ma truy cap ca nhan tao trong trang Ho so).
  Server KHONG luu tai khoan/mat khau nao: moi nguoi chi lam duoc dung quyen cua tai khoan minh.
- Ma duoc kiem tra voi backend truoc khi vao MCP (luu ket qua 60 giay), ma sai -> 401 ngay tai cong.
- Chong DNS rebinding: chi nhan Host trong EDUEXAM_MCP_ALLOWED_HOSTS.
"""

from __future__ import annotations

import json
import os
import time
from typing import Callable

import anyio
from mcp.server.transport_security import TransportSecuritySettings

from .client import EduExamClient, EduExamError
from .core import bearer_from_request, client_for_token, enable_http_mode, mcp

TOKEN_CHECK_TTL_SECONDS = 60


class BackendUnavailable(RuntimeError):
    """Khong goi duoc backend de kiem tra ma (khong phai loi cua nguoi dung)."""


class _Headers:
    def __init__(self, scope):
        self._headers = {key.decode("latin-1").lower(): value.decode("latin-1") for key, value in scope.get("headers", [])}

    def get(self, key, default=""):
        return self._headers.get(key.lower(), default)


async def _send_json(send, status: int, payload: dict, extra_headers: list[tuple[bytes, bytes]] | None = None):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = [(b"content-type", b"application/json; charset=utf-8"), (b"content-length", str(len(body)).encode())]
    await send({"type": "http.response.start", "status": status, "headers": headers + (extra_headers or [])})
    await send({"type": "http.response.body", "body": body})


class TokenAuthMiddleware:
    """Chan request /mcp khong co ma hop le truoc khi vao MCP."""

    def __init__(self, app, *, mcp_path: str, validate: Callable[[str], bool]):
        self.app = app
        self.mcp_path = mcp_path.rstrip("/")
        self.validate = validate
        self._cache: dict[str, tuple[bool, float]] = {}

    async def _is_valid(self, token: str) -> bool:
        cached = self._cache.get(token)
        now = time.monotonic()
        if cached and now - cached[1] < TOKEN_CHECK_TTL_SECONDS:
            return cached[0]
        valid = await anyio.to_thread.run_sync(self.validate, token)
        if len(self._cache) > 1000:
            self._cache.clear()
        self._cache[token] = (valid, now)
        return valid

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        if path in {"/healthz", "/mcp/healthz"}:
            return await _send_json(send, 200, {"status": "ok"})
        if path.rstrip("/") == self.mcp_path or path.startswith(self.mcp_path + "/"):
            token = bearer_from_request(_Headers(scope))
            challenge = [(b"www-authenticate", b'Bearer realm="eduexam-mcp"')]
            if not token:
                return await _send_json(
                    send,
                    401,
                    {"error": "Thieu ma truy cap. Gui header Authorization: Bearer eduexam_pat_..."},
                    challenge,
                )
            try:
                valid = await self._is_valid(token)
            except BackendUnavailable:
                return await _send_json(send, 503, {"error": "Backend EduExam tam thoi khong truy cap duoc, thu lai sau."})
            if not valid:
                return await _send_json(
                    send, 401, {"error": "Ma truy cap khong hop le, het han hoac da bi thu hoi."}, challenge
                )
        return await self.app(scope, receive, send)


def _default_validate(token: str) -> bool:
    import httpx

    try:
        client_for_token(token).get("/api/v1/profile/")
        return True
    except EduExamError as exc:
        if exc.status_code in {401, 403}:
            return False
        raise BackendUnavailable(str(exc)) from exc
    except httpx.HTTPError as exc:
        raise BackendUnavailable(str(exc)) from exc


def build_http_app(
    *,
    mcp_path: str = "/mcp",
    allowed_hosts: list[str] | None = None,
    allowed_origins: list[str] | None = None,
    client_factory: Callable[[str], EduExamClient] | None = None,
    validate: Callable[[str], bool] | None = None,
):
    enable_http_mode(client_factory)
    mcp.settings.streamable_http_path = mcp_path
    # Khong giu phien tren server: chay duoc nhieu tien trinh/khoi dong lai khong mat ket noi.
    mcp.settings.stateless_http = True
    mcp.settings.json_response = True
    hosts = allowed_hosts or ["127.0.0.1:*", "localhost:*"]
    mcp.settings.transport_security = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=hosts,
        allowed_origins=allowed_origins or [f"https://{host.split(':')[0]}" for host in hosts],
    )
    # Bo quan ly phien chi khoi dong duoc 1 lan: tao moi moi khi dung app (vd. test, khoi dong lai).
    mcp._session_manager = None
    app = mcp.streamable_http_app()
    return TokenAuthMiddleware(app, mcp_path=mcp_path, validate=validate or _default_validate)


def _env_list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def run_http(host: str, port: int) -> None:
    import uvicorn

    app = build_http_app(
        mcp_path=os.environ.get("EDUEXAM_MCP_PATH", "/mcp"),
        allowed_hosts=_env_list("EDUEXAM_MCP_ALLOWED_HOSTS", "127.0.0.1:*,localhost:*"),
        allowed_origins=_env_list("EDUEXAM_MCP_ALLOWED_ORIGINS", "") or None,
    )
    uvicorn.run(app, host=host, port=port, proxy_headers=True, forwarded_allow_ips="*", log_level="info")
