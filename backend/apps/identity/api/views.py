from django.db.models import Prefetch, Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.identity.models import Permission, Role, User, UserRole
from apps.identity.permissions import HasAPIPermissionCode
from apps.identity.services import request_password_reset, reset_password_with_token
from apps.platform_core.audit import record_audit_event
from apps.platform_core.i18n import t

from .serializers import (
    ChangePasswordSerializer,
    EduExamTokenObtainPairSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    PermissionSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    RoleSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = EduExamTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record_audit_event(
            actor=getattr(serializer, "user", None),
            action="user.login",
            category="authentication",
            description="User logged in successfully.",
            request=request,
        )
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    pass


class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in {"PUT", "PATCH"}:
            return ProfileUpdateSerializer
        return ProfileSerializer

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=request.method == "PATCH")
        serializer.is_valid(raise_exception=True)
        serializer.save()
        output = ProfileSerializer(user, context={"request": request})
        return Response(output.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    @extend_schema(request=ChangePasswordSerializer, responses={200: None})
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response(
            {"detail": t(vi="Đã cập nhật mật khẩu thành công.", en="Password updated successfully.")},
            status=status.HTTP_200_OK,
        )


class ForgotPasswordView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = ForgotPasswordSerializer

    @extend_schema(request=ForgotPasswordSerializer, responses={202: None})
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_password_reset(serializer.validated_data["email"])
        return Response(
            {
                "detail": t(
                    vi="Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi.",
                    en="If an account exists for that email, password reset instructions will be sent.",
                )
            },
            status=status.HTTP_202_ACCEPTED,
        )


class ResetPasswordView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = ResetPasswordSerializer

    @extend_schema(request=ResetPasswordSerializer, responses={200: None})
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_password_with_token(
            uid=serializer.validated_data["uid"],
            token=serializer.validated_data["token"],
            new_password=serializer.validated_data["new_password"],
        )
        return Response(
            {"detail": t(vi="Mật khẩu đã được cập nhật.", en="Password has been updated.")},
            status=status.HTTP_200_OK,
        )


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "users.view",
        "POST": "users.manage",
        "PUT": "users.manage",
        "PATCH": "users.manage",
        "DELETE": "users.manage",
    }

    def get_queryset(self):
        queryset = (
            User.objects.select_related("profile__school")
            .prefetch_related(
                Prefetch("user_roles", queryset=UserRole.objects.select_related("role"))
            )
            .order_by("email")
        )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) | Q(full_name__icontains=search)
            )
        role_slug = self.request.query_params.get("role")
        if role_slug:
            queryset = queryset.filter(user_roles__role__slug=role_slug, user_roles__is_active=True)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset.distinct()

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": t(vi="Bạn không thể tự khóa tài khoản của mình.", en="You cannot lock your own account.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.status = User.Status.LOCKED
        user.is_active = False
        user.save(update_fields=["status", "is_active"])
        record_audit_event(
            actor=request.user,
            action="user.locked",
            category="security",
            severity="warning",
            description=f'Locked user "{user.email}".',
            metadata={
                "target_user_id": user.id,
                "target_email": user.email,
                "target_full_name": user.full_name,
            },
            request=request,
        )
        return Response({"id": user.id, "status": user.status})

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        user = self.get_object()
        user.status = User.Status.ACTIVE
        user.is_active = True
        user.save(update_fields=["status", "is_active"])
        record_audit_event(
            actor=request.user,
            action="user.unlocked",
            category="security",
            description=f'Unlocked user "{user.email}".',
            metadata={
                "target_user_id": user.id,
                "target_email": user.email,
                "target_full_name": user.full_name,
            },
            request=request,
        )
        return Response({"id": user.id, "status": user.status})

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": t(vi="Bạn không thể tự xóa tài khoản của mình.", en="You cannot delete your own account.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class RoleViewSet(viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "roles.view",
        "POST": "roles.manage",
        "PUT": "roles.manage",
        "PATCH": "roles.manage",
        "DELETE": "roles.manage",
    }
    queryset = Role.objects.prefetch_related("permissions").order_by("name")

    def perform_create(self, serializer):
        role = serializer.save()
        record_audit_event(
            actor=self.request.user,
            action="role.created",
            category="security",
            description=f'Created role "{role.name}".',
            metadata={
                "role_id": role.id,
                "role_slug": role.slug,
                "permission_codes": list(role.permissions.values_list("code", flat=True)),
            },
            request=self.request,
        )

    def perform_update(self, serializer):
        role = serializer.instance
        previous_permission_codes = list(role.permissions.values_list("code", flat=True))
        role = serializer.save()
        record_audit_event(
            actor=self.request.user,
            action="role.updated",
            category="security",
            description=f'Updated role "{role.name}".',
            metadata={
                "role_id": role.id,
                "role_slug": role.slug,
                "previous_permission_codes": previous_permission_codes,
                "permission_codes": list(role.permissions.values_list("code", flat=True)),
            },
            request=self.request,
        )

    def perform_destroy(self, instance):
        record_audit_event(
            actor=self.request.user,
            action="role.deleted",
            category="security",
            severity="warning",
            description=f'Deleted role "{instance.name}".',
            metadata={
                "role_id": instance.id,
                "role_slug": instance.slug,
                "permission_codes": list(instance.permissions.values_list("code", flat=True)),
            },
            request=self.request,
        )
        super().perform_destroy(instance)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {"GET": "permissions.view"}
    queryset = Permission.objects.order_by("module", "action")
