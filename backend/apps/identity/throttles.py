"""Gioi han tan suat cho cac endpoint xac thuc cong khai.

Ca lop hoc thuong dung chung 1 IP (NAT cua truong), nen gioi han theo IP de rong,
con gioi han chat duoc tinh theo (tai khoan + IP) de chan do mat khau ma khong
khoa ca phong thi. Toc do doc tu settings moi lan (None = tat) de test/van hanh
co the doi bang override_settings hoac bien moi truong.
"""

import hashlib

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class _SettingsRateThrottle(SimpleRateThrottle):
    setting_name = ""

    def get_rate(self):
        return getattr(settings, self.setting_name, None) or None

    def _key(self, ident):
        return self.cache_format % {"scope": self.scope, "ident": ident}


def _hashed(value):
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()[:32]


class _IPThrottle(_SettingsRateThrottle):
    def get_cache_key(self, request, view):
        return self._key(self.get_ident(request))


class LoginIPThrottle(_IPThrottle):
    scope = "auth_login_ip"
    setting_name = "AUTH_LOGIN_IP_THROTTLE_RATE"


class LoginAccountThrottle(_SettingsRateThrottle):
    scope = "auth_login_account"
    setting_name = "AUTH_LOGIN_ACCOUNT_THROTTLE_RATE"

    def get_cache_key(self, request, view):
        data = getattr(request, "data", None) or {}
        identifier = data.get("identifier") or data.get("email") or data.get("username")
        if not isinstance(identifier, str) or not identifier.strip():
            return None
        return self._key(f"{_hashed(identifier)}:{self.get_ident(request)}")


class PasswordResetIPThrottle(_IPThrottle):
    scope = "auth_password_reset_ip"
    setting_name = "AUTH_PASSWORD_RESET_IP_THROTTLE_RATE"


class PasswordResetEmailThrottle(_SettingsRateThrottle):
    scope = "auth_password_reset_email"
    setting_name = "AUTH_PASSWORD_RESET_EMAIL_THROTTLE_RATE"

    def get_cache_key(self, request, view):
        data = getattr(request, "data", None) or {}
        email = data.get("email")
        if not isinstance(email, str) or not email.strip():
            return None
        return self._key(_hashed(email))
