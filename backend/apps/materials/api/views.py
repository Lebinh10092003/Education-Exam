from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasAPIPermissionCode

from ..models import Material
from .serializers import MaterialDownloadSerializer, MaterialSerializer


class MaterialViewSet(viewsets.ModelViewSet):
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "materials.view",
        "POST": "materials.manage",
        "PUT": "materials.manage",
        "PATCH": "materials.manage",
        "DELETE": "materials.manage",
    }
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Material.objects.select_related("subject", "uploaded_by").order_by("-created_at", "title")
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(subject__name__icontains=search)
                | Q(subject__code__icontains=search)
            )
        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        is_active = self.request.query_params.get("is_active")
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        return queryset

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        material = self.get_object()
        material.download_count += 1
        material.save(update_fields=["download_count", "updated_at"])
        payload = {
            "file_url": self.get_serializer(material).data["file_url"],
            "download_count": material.download_count,
        }
        output = MaterialDownloadSerializer(payload)
        return Response(output.data, status=status.HTTP_200_OK)

