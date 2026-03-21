from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    ChangePasswordView,
    ForgotPasswordView,
    LoginView,
    PermissionViewSet,
    ProfileView,
    RefreshView,
    RoleViewSet,
    UserViewSet,
)


router = SimpleRouter()
router.register("users", UserViewSet, basename="users")
router.register("roles", RoleViewSet, basename="roles")
router.register("permissions", PermissionViewSet, basename="permissions")


urlpatterns = [
    path("auth/forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("profile/", ProfileView.as_view(), name="profile-detail"),
    path("profile/change-password/", ChangePasswordView.as_view(), name="profile-change-password"),
] + router.urls
