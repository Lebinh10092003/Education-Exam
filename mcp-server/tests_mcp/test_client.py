import httpx
import pytest

from eduexam_mcp.client import EduExamClient, EduExamError


def _client(handler):
    return EduExamClient("http://api", identifier="admin", password="pw", transport=httpx.MockTransport(handler))


def test_refreshes_expired_token_and_retries_once():
    calls = []

    def handler(request):
        calls.append((request.method, request.url.path, request.headers.get("authorization")))
        if request.url.path == "/api/v1/auth/login/":
            return httpx.Response(200, json={"access": "old", "refresh": "r1"})
        if request.url.path == "/api/v1/auth/refresh/":
            return httpx.Response(200, json={"access": "new"})
        if request.headers.get("authorization") == "Bearer old":
            return httpx.Response(401, json={"detail": "token expired"})
        return httpx.Response(200, json={"ok": True})

    assert _client(handler).get("/api/v1/profile/") == {"ok": True}
    assert [path for _, path, _ in calls] == [
        "/api/v1/auth/login/", "/api/v1/profile/", "/api/v1/auth/refresh/", "/api/v1/profile/",
    ]


def test_missing_credentials_gives_clear_error():
    client = EduExamClient("http://api", transport=httpx.MockTransport(lambda r: httpx.Response(200)))
    with pytest.raises(EduExamError, match="EDUEXAM_IDENTIFIER"):
        client.get("/api/v1/profile/")


def test_empty_params_are_dropped():
    seen = {}

    def handler(request):
        if request.url.path.endswith("/login/"):
            return httpx.Response(200, json={"access": "a", "refresh": "r"})
        seen["query"] = dict(request.url.params)
        return httpx.Response(200, json={})

    _client(handler).get("/api/v1/questions/", search="", subject=None, page=2)
    assert seen["query"] == {"page": "2"}
