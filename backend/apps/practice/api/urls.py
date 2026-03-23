from django.urls import path

from .views import (
    PracticeCatalogView,
    PracticeHistoryView,
    PracticeSessionAnswerView,
    PracticeSessionAutosaveView,
    PracticeSessionCreateView,
    PracticeSessionDetailView,
    PracticeSessionReviewView,
    PracticeSessionSubmitView,
)


urlpatterns = [
    path("practice/catalog/", PracticeCatalogView.as_view(), name="practice-catalog"),
    path("practice/history/", PracticeHistoryView.as_view(), name="practice-history"),
    path("practice/sessions/", PracticeSessionCreateView.as_view(), name="practice-session-create"),
    path("practice/sessions/<int:pk>/", PracticeSessionDetailView.as_view(), name="practice-session-detail"),
    path(
        "practice/sessions/<int:session_id>/answers/<int:question_id>/",
        PracticeSessionAnswerView.as_view(),
        name="practice-session-answer",
    ),
    path("practice/sessions/<int:pk>/autosave/", PracticeSessionAutosaveView.as_view(), name="practice-session-autosave"),
    path("practice/sessions/<int:pk>/submit/", PracticeSessionSubmitView.as_view(), name="practice-session-submit"),
    path("practice/sessions/<int:pk>/review/", PracticeSessionReviewView.as_view(), name="practice-session-review"),
]
