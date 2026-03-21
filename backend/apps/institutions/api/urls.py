from rest_framework.routers import SimpleRouter

from .views import CandidateGroupViewSet, SchoolViewSet


router = SimpleRouter()
router.register("schools", SchoolViewSet, basename="schools")
router.register("groups", CandidateGroupViewSet, basename="groups")

urlpatterns = router.urls
