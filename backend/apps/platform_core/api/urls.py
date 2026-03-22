from django.urls import path

from .views import AuditEventListView, AuditEventSummaryView, LivenessView, ReadinessView


urlpatterns = [
    path("health/live/", LivenessView.as_view(), name="health-live"),
    path("health/ready/", ReadinessView.as_view(), name="health-ready"),
    path("audit/events/", AuditEventListView.as_view(), name="audit-events"),
    path("audit/events/summary/", AuditEventSummaryView.as_view(), name="audit-events-summary"),
]
