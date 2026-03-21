from django.db.models import Count, Q
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.academics.models import Subject
from apps.identity.permissions import HasAPIPermissionCode

from .serializers import SubjectSerializer


class SubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "subjects.view",
        "POST": "subjects.manage",
        "PUT": "subjects.manage",
        "PATCH": "subjects.manage",
        "DELETE": "subjects.manage",
    }
    filter_backends = [filters.SearchFilter]
    search_fields = ("name", "code", "description")

    def get_queryset(self):
        queryset = Subject.objects.annotate(
            questions_count=Count("questions", distinct=True),
            exams_count=Count("exams", distinct=True),
        )
        is_active = self.request.query_params.get("is_active")
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(description__icontains=search)
            )
        return queryset.order_by("name", "id")
