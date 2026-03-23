import time
from typing import TypedDict

import jwt
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class MediaProviderToken(TypedDict):
    provider: str
    server_url: str
    room_name: str
    participant_name: str
    access_token: str
    expires_at: str


class BaseMediaProvider:
    provider_name = "base"

    def build_publish_token(self, *, session, user) -> MediaProviderToken:
        raise NotImplementedError

    def build_view_token(self, *, session, user) -> MediaProviderToken:
        raise NotImplementedError


class LiveKitMediaProvider(BaseMediaProvider):
    provider_name = "livekit"

    def _require_settings(self):
        if not settings.PROCTORING_MEDIA_URL:
            raise ImproperlyConfigured("PROCTORING_MEDIA_URL must be configured for live proctoring.")
        if not settings.PROCTORING_MEDIA_API_KEY:
            raise ImproperlyConfigured("PROCTORING_MEDIA_API_KEY must be configured for live proctoring.")
        if not settings.PROCTORING_MEDIA_API_SECRET:
            raise ImproperlyConfigured("PROCTORING_MEDIA_API_SECRET must be configured for live proctoring.")

    def _room_name(self, *, session):
        prefix = settings.PROCTORING_MEDIA_ROOM_PREFIX
        return f"{prefix}exam-{session.exam_id}-session-{session.id}"

    def _build_token(self, *, session, participant_name, can_publish, can_subscribe):
        self._require_settings()
        issued_at = int(time.time())
        expires_at = issued_at + settings.PROCTORING_MEDIA_TOKEN_TTL_SECONDS
        room_name = self._room_name(session=session)
        token = jwt.encode(
            {
                "iss": settings.PROCTORING_MEDIA_API_KEY,
                "sub": participant_name,
                "nbf": issued_at,
                "exp": expires_at,
                "name": participant_name,
                "video": {
                    "roomJoin": True,
                    "room": room_name,
                    "canPublish": can_publish,
                    "canSubscribe": can_subscribe,
                    "canPublishData": False,
                },
            },
            settings.PROCTORING_MEDIA_API_SECRET,
            algorithm="HS256",
        )
        return {
            "provider": self.provider_name,
            "server_url": settings.PROCTORING_MEDIA_URL,
            "room_name": room_name,
            "participant_name": participant_name,
            "access_token": token,
            "expires_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(expires_at)),
        }

    def build_publish_token(self, *, session, user) -> MediaProviderToken:
        participant_name = f"candidate-{user.id}-session-{session.id}"
        return self._build_token(
            session=session,
            participant_name=participant_name,
            can_publish=True,
            can_subscribe=False,
        )

    def build_view_token(self, *, session, user) -> MediaProviderToken:
        participant_name = f"proctor-{user.id}-session-{session.id}"
        return self._build_token(
            session=session,
            participant_name=participant_name,
            can_publish=False,
            can_subscribe=True,
        )


def get_media_provider():
    if settings.PROCTORING_MEDIA_PROVIDER == "livekit":
        return LiveKitMediaProvider()
    raise ImproperlyConfigured(
        f"Unsupported proctoring media provider: {settings.PROCTORING_MEDIA_PROVIDER}"
    )
