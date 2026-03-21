from rest_framework.routers import SimpleRouter

from .views import QuestionImportBatchViewSet, QuestionTagViewSet, QuestionViewSet


router = SimpleRouter()
router.register("questions", QuestionViewSet, basename="questions")
router.register("question-tags", QuestionTagViewSet, basename="question-tags")
router.register("question-imports", QuestionImportBatchViewSet, basename="question-imports")

urlpatterns = router.urls
