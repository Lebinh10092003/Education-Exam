from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    CompetitionRegistrationViewSet,
    CompetitionViewSet,
    PublicCompetitionListView,
    PublicRegistrationCreateView,
)

router = SimpleRouter()
router.register("competitions", CompetitionViewSet, basename="competitions")
router.register("competition-registrations", CompetitionRegistrationViewSet, basename="competition-registrations")

urlpatterns = [
    path("public/competitions/", PublicCompetitionListView.as_view(), name="public-competitions"),
    path("public/competition-registrations/", PublicRegistrationCreateView.as_view(), name="public-competition-registrations"),
] + router.urls
