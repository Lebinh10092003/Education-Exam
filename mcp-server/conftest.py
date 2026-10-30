import os
from pathlib import Path

import httpx
import pytest

# Backend doc .env va duong dan CSDL test tu thu muc backend.
os.chdir(Path(__file__).resolve().parent.parent / "backend")

# Dung lai fixture cua backend (admin_user, candidate_user, subject, ...): "tests" = backend/tests.
pytest_plugins = ["tests.conftest"]


@pytest.fixture
def mcp_client(admin_user):
    """MCP client goi thang vao Django (WSGI) voi CSDL test, dang nhap bang tai khoan admin that."""
    from django.core.wsgi import get_wsgi_application

    from eduexam_mcp import server
    from eduexam_mcp.client import EduExamClient

    admin_user.set_password("mcp-secret-123")
    admin_user.save(update_fields=["password"])
    client = EduExamClient(
        "http://testserver",
        identifier=admin_user.email,
        password="mcp-secret-123",
        transport=httpx.WSGITransport(app=get_wsgi_application()),
    )
    server.set_client(client)
    yield client
    server.set_client(None)
    client.close()
