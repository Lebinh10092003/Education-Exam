from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    AdminSessionMediaViewTokenView,
    CandidateSessionCapabilityView,
    CandidateSessionEvidenceView,
    CandidateSessionEventView,
    CandidateSessionHeartbeatView,
    CandidateSessionMediaPublishTokenView,
    CandidateSessionMediaStatusView,
    ExamMonitoringSnapshotView,
    ViolationCaseExportView,
    ViolationCaseViewSet,
)


router = SimpleRouter()
router.register("proctoring/cases", ViolationCaseViewSet, basename="proctoring-cases")

urlpatterns = [
    path(
        "proctoring/cases/export/",
        ViolationCaseExportView.as_view(),
        name="proctoring-cases-export",
    ),
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
        "proctoring/sessions/<int:session_id>/media/publish-token/",
        CandidateSessionMediaPublishTokenView.as_view(),
        name="proctoring-session-media-publish-token",
    ),
    path(
        "proctoring/sessions/<int:session_id>/media/status/",
        CandidateSessionMediaStatusView.as_view(),
        name="proctoring-session-media-status",
    ),
    path(
        "proctoring/sessions/<int:session_id>/media/view-token/",
        AdminSessionMediaViewTokenView.as_view(),
        name="proctoring-session-media-view-token",
    ),
    path(
        "proctoring/exams/<int:exam_id>/monitoring/",
        ExamMonitoringSnapshotView.as_view(),
        name="proctoring-exam-monitoring",
    ),
] + router.urls
