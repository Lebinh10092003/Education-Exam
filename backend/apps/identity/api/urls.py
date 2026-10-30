from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    ChangePasswordView,
    ForgotPasswordView,
    LoginView,
    PermissionViewSet,
    ProfileView,
    RefreshView,
    ResetPasswordView,
    RoleViewSet,
    UserViewSet,
)
from .api_token_views import ApiTokenViewSet


router = SimpleRouter()
router.register("users", UserViewSet, basename="users")
router.register("roles", RoleViewSet, basename="roles")
router.register("permissions", PermissionViewSet, basename="permissions")
router.register("api-tokens", ApiTokenViewSet, basename="api-tokens")


urlpatterns = [
    path("auth/forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("profile/", ProfileView.as_view(), name="profile-detail"),
    path("profile/change-password/", ChangePasswordView.as_view(), name="profile-change-password"),
] + router.urls
