from django.urls import path

from .consumers import MonitoringConsumer


websocket_urlpatterns = [
    path("ws/monitoring/exams/<int:exam_id>/", MonitoringConsumer.as_asgi()),
]
