from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    CandidateSessionCapabilityView,
    CandidateSessionEvidenceView,
    CandidateSessionEventView,
    CandidateSessionHeartbeatView,
    ExamMonitoringSnapshotView,
    ViolationCaseViewSet,
)


router = SimpleRouter()
router.register("proctoring/cases", ViolationCaseViewSet, basename="proctoring-cases")

urlpatterns = [
    path(
        "proctoring/sessions/<int:session_id>/capability/",
        CandidateSessionCapabilityView.as_view(),
        name="proctoring-session-capability",
    ),
    path(
        "proctoring/sessions/<int:session_id>/heartbeats/",
        CandidateSessionHeartbeatView.as_view(),
        name="proctoring-session-heartbeats",
    ),
    path(
        "proctoring/sessions/<int:session_id>/events/",
        CandidateSessionEventView.as_view(),
        name="proctoring-session-events",
    ),
    path(
        "proctoring/sessions/<int:session_id>/evidence/",
        CandidateSessionEvidenceView.as_view(),
        name="proctoring-session-evidence",
    ),
    path(
        "proctoring/exams/<int:exam_id>/monitoring/",
        ExamMonitoringSnapshotView.as_view(),
        name="proctoring-exam-monitoring",
    ),
] + router.urls
