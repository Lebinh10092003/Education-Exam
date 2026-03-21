from rest_framework.routers import SimpleRouter

from .views import MaterialViewSet


router = SimpleRouter()
router.register("materials", MaterialViewSet, basename="materials")

urlpatterns = router.urls

