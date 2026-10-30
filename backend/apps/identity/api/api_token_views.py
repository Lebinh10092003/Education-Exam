from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.platform_core.audit import record_audit_event

from ..api_tokens import create_api_token, revoke_api_token
from ..models import ApiToken


class IsStaffUser(BasePermission):
    message = "Chỉ tài khoản quản trị mới tạo được mã truy cập MCP."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class ApiTokenSerializer(serializers.ModelSerializer):
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = ApiToken
        fields = ("id", "name", "key_prefix", "created_at", "expires_at", "last_used_at", "revoked_at", "is_active")

    def get_is_active(self, obj):
        from django.utils import timezone

        return obj.revoked_at is None and (obj.expires_at is None or obj.expires_at > timezone.now())


class ApiTokenCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    # 0 = khong het han (khong khuyen khich).
    expires_in_days = serializers.IntegerField(min_value=0, max_value=365, default=90)


class ApiTokenViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Ma truy cap MCP cua CHINH tai khoan dang dang nhap (khong xem/thu hoi duoc ma cua nguoi khac)."""

    permission_classes = [IsAuthenticated, IsStaffUser]
    serializer_class = ApiTokenSerializer
    pagination_class = None

    def get_queryset(self):
        return ApiToken.objects.filter(user=self.request.user).order_by("-created_at")

    def create(self, request):
        serializer = ApiTokenCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token, raw_token = create_api_token(
            user=request.user,
            name=serializer.validated_data["name"],
            expires_in_days=serializer.validated_data["expires_in_days"],
        )
        record_audit_event(
            actor=request.user,
            action="api_token.created",
            category="security",
            severity="warning",
            description=f'Created MCP access token "{token.name}".',
            metadata={"token_id": token.id, "key_prefix": token.key_prefix},
            request=request,
        )
        # Ma goc chi tra ve DUY NHAT lan nay.
        return Response({**ApiTokenSerializer(token).data, "token": raw_token}, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        token = self.get_object()
        revoke_api_token(token)
        record_audit_event(
            actor=request.user,
            action="api_token.revoked",
            category="security",
            description=f'Revoked MCP access token "{token.name}".',
            metadata={"token_id": token.id, "key_prefix": token.key_prefix},
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
