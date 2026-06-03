from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasAPIPermissionCode
from apps.institutions.models import CandidateGroup, GroupMembership, School
from apps.institutions.services import import_memberships_to_group

from .serializers import (
    CandidateGroupSerializer,
    GroupMembershipSerializer,
    GroupMembershipImportSummarySerializer,
    SchoolSerializer,
)


class SchoolViewSet(viewsets.ModelViewSet):
    serializer_class = SchoolSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "schools.view",
        "POST": "schools.manage",
        "PUT": "schools.manage",
        "PATCH": "schools.manage",
        "DELETE": "schools.manage",
    }

    def get_queryset(self):
        queryset = School.objects.all()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        is_active = self.request.query_params.get("is_active")
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        return queryset


class CandidateGroupViewSet(viewsets.ModelViewSet):
    serializer_class = CandidateGroupSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "groups.view",
        "POST": "groups.manage",
        "PUT": "groups.manage",
        "PATCH": "groups.manage",
        "DELETE": "groups.manage",
    }

    def get_queryset(self):
        queryset = CandidateGroup.objects.annotate(
            member_count=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
            exams_count=Count("exam_assignments__exam", distinct=True),
        )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
            )
        is_active = self.request.query_params.get("is_active")
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        return queryset

    @action(detail=True, methods=["get", "post", "delete"], url_path="memberships")
    def memberships(self, request, pk=None):
        group = self.get_object()
        if request.method == "GET":
            queryset = group.memberships.select_related("user").order_by("user__email")
            page = self.paginate_queryset(queryset)
            serializer = GroupMembershipSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        if request.method == "DELETE":
            user_id = request.query_params.get("user_id")
            if not user_id:
                return Response(
                    {"detail": "user_id query parameter is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                membership = group.memberships.get(user_id=user_id)
                membership.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            except GroupMembership.DoesNotExist:
                return Response(
                    {"detail": "Membership not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        serializer = GroupMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(group=group)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request=None,
        responses=GroupMembershipImportSummarySerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="memberships/import",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_memberships(self, request, pk=None):
        group = self.get_object()
        summary = import_memberships_to_group(
            group=group,
            uploaded_file=request.FILES.get("file"),
        )
        serializer = GroupMembershipImportSummarySerializer(summary)
        return Response(serializer.data, status=status.HTTP_200_OK)
