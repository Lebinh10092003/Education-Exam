from rest_framework.routers import SimpleRouter

from .views import ManualGradingTaskViewSet, ResultViewSet


router = SimpleRouter()
router.register("grading/tasks", ManualGradingTaskViewSet, basename="grading-tasks")
router.register("results", ResultViewSet, basename="results")

urlpatterns = router.urls
