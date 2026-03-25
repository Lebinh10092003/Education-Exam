from django.urls import path

from .consumers import CandidateSessionControlConsumer, MonitoringConsumer


websocket_urlpatterns = [
    path("ws/monitoring/exams/<int:exam_id>/", MonitoringConsumer.as_asgi()),
    path("ws/proctoring/sessions/<int:session_id>/control/", CandidateSessionControlConsumer.as_asgi()),
]
