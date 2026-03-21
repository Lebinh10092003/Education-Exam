from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", include("apps.platform_core.api.urls")),
    path("api/v1/", include("apps.platform_core.api.dashboard_urls")),
    path("api/v1/", include("apps.identity.api.urls")),
    path("api/v1/", include("apps.institutions.api.urls")),
    path("api/v1/", include("apps.academics.api.urls")),
    path("api/v1/", include("apps.question_bank.api.urls")),
    path("api/v1/", include("apps.exam_authoring.api.urls")),
    path("api/v1/", include("apps.exam_delivery.api.urls")),
    path("api/v1/", include("apps.grading.api.urls")),
    path("api/v1/", include("apps.proctoring.api.urls")),
    path("api/v1/", include("apps.materials.api.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
