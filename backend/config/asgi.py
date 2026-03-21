import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from apps.proctoring.auth import QueryStringJWTAuthMiddlewareStack
from apps.proctoring.routing import websocket_urlpatterns


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": QueryStringJWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
