from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    CandidateAssignedExamListView,
    CandidateDashboardOverviewView,
    CandidateExamStartView,
    ExamSessionViewSet,
    SessionAnswerWriteAPIView,
)


router = SimpleRouter()
router.register("exam-sessions", ExamSessionViewSet, basename="exam-sessions")

urlpatterns = [
    path("my-exams/", CandidateAssignedExamListView.as_view(), name="my-exams"),
    path("my-dashboard/overview/", CandidateDashboardOverviewView.as_view(), name="my-dashboard-overview"),
    path("exams/<int:pk>/start-session/", CandidateExamStartView.as_view(), name="exam-start-session"),
    path(
        "exam-sessions/<int:session_id>/answers/<int:question_id>/",
        SessionAnswerWriteAPIView.as_view(),
        name="session-answer-write",
    ),
] + router.urls
