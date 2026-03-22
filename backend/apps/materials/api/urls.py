from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CandidateMaterialListView, MaterialViewSet


router = SimpleRouter()
router.register("materials", MaterialViewSet, basename="materials")

urlpatterns = [
    path("my-materials/", CandidateMaterialListView.as_view(), name="my-materials"),
] + router.urls

