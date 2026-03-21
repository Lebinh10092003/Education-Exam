from django.db.models import Count, Exists, OuterRef, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasAPIPermissionCode
from apps.institutions.models import CandidateGroup

from ..models import Exam, ExamAssignment
from ..services import build_exam_assignment_summary, clone_exam, sync_exam_assignments
from .serializers import (
    ExamGroupAssignmentSerializer,
    ExamGroupAssignmentSyncSerializer,
    ExamReadSerializer,
    ExamWriteSerializer,
)


class ExamViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "exams.view",
        "POST": "exams.manage",
        "PUT": "exams.manage",
        "PATCH": "exams.manage",
        "DELETE": "exams.manage",
    }

    def get_queryset(self):
        queryset = (
            Exam.objects.select_related("subject", "current_version", "schedule_window")
            .prefetch_related(
                "current_version__items__question_revision__question",
                "current_version__random_rules",
                "assignments__group__school",
                "assignments__user",
            )
            .annotate(
                total_sessions=Count("sessions", distinct=True),
                in_progress_sessions=Count(
                    "sessions",
                    filter=Q(sessions__status="in_progress"),
                    distinct=True,
                ),
                submitted_sessions=Count(
                    "sessions",
                    filter=Q(sessions__status="submitted"),
                    distinct=True,
                ),
            )
            .order_by("-created_at")
        )

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(subject__name__icontains=search))

        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)

        return queryset.distinct()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ExamWriteSerializer
        return ExamReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        exam = serializer.save()
        output = ExamReadSerializer(exam, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        exam = self.get_object()
        serializer = self.get_serializer(
            exam,
            data=request.data,
            partial=kwargs.get("partial", False),
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        exam = serializer.save()
        output = ExamReadSerializer(exam, context=self.get_serializer_context())
        return Response(output.data)

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        exam = self.get_object()
        cloned = clone_exam(exam=exam, created_by=request.user)
        output = ExamReadSerializer(cloned, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="group-assignments")
    def group_assignments(self, request, pk=None):
        exam = self.get_object()
        if request.method == "GET":
            search = request.query_params.get("search")
            assigned_groups = ExamAssignment.objects.filter(exam=exam, group_id=OuterRef("pk"))
            queryset = CandidateGroup.objects.select_related("school").annotate(
                member_count=Count(
                    "memberships",
                    filter=Q(memberships__is_active=True),
                    distinct=True,
                ),
                assigned=Exists(assigned_groups),
            )
            if search:
                queryset = queryset.filter(name__icontains=search)
            serializer = ExamGroupAssignmentSerializer(
                [
                    {
                        "id": group.id,
                        "name": group.name,
                        "member_count": group.member_count,
                        "assigned": group.assigned,
                        "school": {
                            "id": group.school_id,
                            "name": group.school.name if group.school else "",
                            "code": group.school.code if group.school else "",
                        },
                    }
                    for group in queryset.order_by("name")
                ],
                many=True,
            )
            return Response({"count": len(serializer.data), "results": serializer.data})

        serializer = ExamGroupAssignmentSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sync_exam_assignments(
            exam=exam,
            assigned_by=request.user,
            group_ids=serializer.validated_data["group_ids"],
        )
        return Response(build_exam_assignment_summary(exam))
