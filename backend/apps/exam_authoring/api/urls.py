from rest_framework.routers import DefaultRouter

from .views import ExamPeriodViewSet, ExamRoomViewSet, ExamViewSet


router = DefaultRouter()
router.register("exams", ExamViewSet, basename="exam")
router.register("exam-periods", ExamPeriodViewSet, basename="exam-period")
router.register("exam-rooms", ExamRoomViewSet, basename="exam-room")

urlpatterns = router.urls
