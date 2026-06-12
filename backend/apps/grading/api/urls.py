from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CandidateResultListView, ManualGradingTaskViewSet, ResultViewSet, PublicResultLookupView


router = SimpleRouter()
router.register("grading/tasks", ManualGradingTaskViewSet, basename="grading-tasks")
router.register("results", ResultViewSet, basename="results")

urlpatterns = [
    path("my-results/", CandidateResultListView.as_view(), name="my-results"),
    path("public-results/lookup/", PublicResultLookupView.as_view(), name="public-results-lookup"),
] + router.urls
