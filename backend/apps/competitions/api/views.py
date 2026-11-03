from io import BytesIO

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from openpyxl import Workbook
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.identity.permissions import HasAPIPermissionCode
from apps.platform_core.audit import record_audit_event

from ..models import Competition, CompetitionRegistration
from ..services import create_registration, public_competitions, update_registration_status
from .serializers import (
    CompetitionSerializer,
    PublicCompetitionSerializer,
    RegistrationCreateSerializer,
    RegistrationSerializer,
    RegistrationUpdateSerializer,
)

MANAGE_CODES = {
    "GET": "exams.view",
    "POST": "exams.manage",
    "PUT": "exams.manage",
    "PATCH": "exams.manage",
    "DELETE": "exams.manage",
}


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None


# ============================== Cong khai ==============================================
class PublicCompetitionListView(APIView):
    """Bang 'Cac cuoc thi noi bat' tren trang chu va danh sach chon khi dang ky."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        parameters=[
            OpenApiParameter("all", OpenApiTypes.STR, description="1/true: lay tat ca thay vi chi cuoc thi noi bat."),
            OpenApiParameter("ended_limit", OpenApiTypes.INT, description="So cuoc thi da ket thuc toi da (mac dinh 6)."),
        ],
        responses=PublicCompetitionSerializer(many=True),
    )
    def get(self, request):
        featured_only = request.query_params.get("all") not in {"1", "true"}
        today = timezone.localdate()
        items = public_competitions(
            featured_only=featured_only,
            ended_limit=int(request.query_params.get("ended_limit", 6) or 6),
            today=today,
        )
        payload = [
            {
                "id": competition.id,
                "name": competition.name,
                "code": competition.code,
                "description": competition.description,
                "cycle": competition.cycle,
                "exam_date": competition.exam_date,
                "registration_deadline": competition.registration_deadline,
                "info_url": competition.info_url,
                "status": competition_status,
                "accepts_registration": competition.accepts_registration_on(today),
            }
            for competition, competition_status in items
        ]
        return Response(PublicCompetitionSerializer(payload, many=True).data)


class PublicRegistrationCreateView(APIView):
    """Phieu dang ky du thi (truoc day chi gia lap, khong luu)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "competition_registration"

    @extend_schema(
        request=RegistrationCreateSerializer,
        responses={
            201: inline_serializer(
                name="PublicRegistrationCreateResponse",
                fields={
                    "id": serializers.IntegerField(),
                    "status": serializers.CharField(),
                    "competitions": serializers.ListField(child=serializers.CharField()),
                },
            )
        },
    )
    def post(self, request):
        serializer = RegistrationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        competitions = data.pop("competitions")
        data.pop("competition_ids", None)
        data.pop("website", None)
        registration = create_registration(data=data, competitions=competitions, source_ip=_client_ip(request))
        return Response(
            {"id": registration.id, "status": registration.status, "competitions": [c.code for c in competitions]},
            status=status.HTTP_201_CREATED,
        )


# ============================== Quan tri ===============================================
class CompetitionViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitionSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = MANAGE_CODES

    def get_queryset(self):
        queryset = Competition.objects.annotate(registration_count=Count("registrations", distinct=True))
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(cycle__icontains=search))
        return queryset.order_by("-exam_date", "sort_order", "id")

    def perform_destroy(self, instance):
        if instance.registrations.exists():
            from rest_framework.exceptions import ValidationError

            raise ValidationError("Cuộc thi đã có lượt đăng ký, hãy ẩn (tắt hiển thị) thay vì xoá.")
        instance.delete()


class CompetitionRegistrationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    serializer_class = RegistrationSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = MANAGE_CODES
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = CompetitionRegistration.objects.prefetch_related("competitions").select_related("handled_by")
        params = self.request.query_params
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("competition"):
            queryset = queryset.filter(competitions__id=params["competition"])
        if params.get("search"):
            term = params["search"]
            queryset = queryset.filter(
                Q(full_name__icontains=term)
                | Q(email__icontains=term)
                | Q(guardian_phone__icontains=term)
                | Q(school__icontains=term)
                | Q(cccd__icontains=term)
            )
        return queryset.distinct().order_by("-created_at", "-id")

    def partial_update(self, request, *args, **kwargs):
        registration = self.get_object()
        serializer = RegistrationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_registration_status(
            registration=registration,
            status=serializer.validated_data["status"],
            admin_note=serializer.validated_data.get("admin_note"),
            user=request.user,
        )
        record_audit_event(
            actor=request.user,
            action="competition_registration.updated",
            category="competitions",
            description=f'Updated registration of "{registration.full_name}" to {registration.status}.',
            metadata={"registration_id": registration.id, "status": registration.status},
            request=request,
        )
        return Response(RegistrationSerializer(registration).data)

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Dang ky"
        headers = [
            "Ngày đăng ký", "Họ tên", "Ngày sinh", "Khối", "Lớp", "Trường", "CCCD", "Email",
            "SĐT phụ huynh", "Địa chỉ", "Phường/Xã", "Tỉnh/Thành", "Cuộc thi", "Trạng thái", "Ghi chú",
        ]
        sheet.append(headers)
        labels = dict(CompetitionRegistration.Status.choices)
        for item in self.get_queryset():
            sheet.append(
                [
                    timezone.localtime(item.created_at).strftime("%d/%m/%Y %H:%M"),
                    item.full_name,
                    item.date_of_birth.strftime("%d/%m/%Y"),
                    item.grade,
                    item.class_name,
                    item.school,
                    item.cccd,
                    item.email,
                    item.guardian_phone,
                    item.address,
                    item.ward,
                    item.city,
                    ", ".join(c.code for c in item.competitions.all()),
                    labels.get(item.status, item.status),
                    item.admin_note,
                ]
            )
        buffer = BytesIO()
        workbook.save(buffer)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="dang-ky-du-thi.xlsx"'
        return response
