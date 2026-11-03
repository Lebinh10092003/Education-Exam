"""Ma truy cap ca nhan (PAT) cho MCP: tao, xac thuc, thu hoi."""

import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import authentication, exceptions

from .models import ApiToken

TOKEN_PREFIX = "eduexam_pat_"
LAST_USED_WRITE_INTERVAL = timedelta(minutes=5)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_api_token(*, user, name, expires_in_days=90):
    """Tao ma moi. Tra ve (ban ghi, ma goc) - ma goc chi co o day, khong luu lai."""
    raw_token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    token = ApiToken.objects.create(
        user=user,
        name=(name or "MCP").strip()[:120],
        key_prefix=raw_token[: len(TOKEN_PREFIX) + 6],
        key_hash=hash_token(raw_token),
        expires_at=timezone.now() + timedelta(days=int(expires_in_days)) if expires_in_days else None,
    )
    return token, raw_token


def revoke_api_token(token):
    if token.revoked_at is None:
        token.revoked_at = timezone.now()
        token.save(update_fields=["revoked_at", "updated_at"])
    return token


def authenticate_api_token(raw_token: str):
    token = ApiToken.objects.select_related("user").filter(key_hash=hash_token(raw_token)).first()
    now = timezone.now()
    if token is None or token.revoked_at is not None:
        raise exceptions.AuthenticationFailed("Mã truy cập không hợp lệ hoặc đã bị thu hồi.")
    if token.expires_at is not None and token.expires_at <= now:
        raise exceptions.AuthenticationFailed("Mã truy cập đã hết hạn.")
    user = token.user
    if not user.is_active or getattr(user, "status", "active") == "locked":
        raise exceptions.AuthenticationFailed("Tài khoản đã bị khoá.")
    if token.last_used_at is None or now - token.last_used_at >= LAST_USED_WRITE_INTERVAL:
        ApiToken.objects.filter(pk=token.pk).update(last_used_at=now)
    return user, token


class ApiTokenAuthentication(authentication.BaseAuthentication):
    """Header: Authorization: Bearer eduexam_pat_... (JWT van dung binh thuong)."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8", errors="ignore")
        parts = header.split()
        if len(parts) != 2 or parts[0] != self.keyword or not parts[1].startswith(TOKEN_PREFIX):
            return None
        return authenticate_api_token(parts[1])

    def authenticate_header(self, request):
        return self.keyword


class ApiTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    """Khai bao PAT trong OpenAPI de Swagger hien dung kieu xac thuc."""

    target_class = "apps.identity.api_tokens.ApiTokenAuthentication"
    name = "apiTokenAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "description": f"Ma truy cap ca nhan dang `{TOKEN_PREFIX}...` (dung cho MCP).",
        }
