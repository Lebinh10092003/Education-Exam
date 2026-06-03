import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

# Initialize Django ASGI application before importing code that may import models
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter

from apps.proctoring.auth import QueryStringJWTAuthMiddlewareStack
from apps.proctoring.routing import websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": QueryStringJWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)

