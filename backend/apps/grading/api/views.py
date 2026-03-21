from decimal import Decimal

from django.db.models import Avg, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasAPIPermissionCode

from ..models import ManualGradingTask, Result
from ..services import grade_manual_task, publish_result
from .serializers import (
    ManualGradingTaskGradeSerializer,
    ManualGradingTaskSerializer,
    ResultSerializer,
    ResultSummarySerializer,
)


class ManualGradingTaskViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ManualGradingTaskSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "grading.view",
        "POST": "grading.manage",
    }

    def get_queryset(self):
        queryset = (
            ManualGradingTask.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
                "session_question",
                "manual_grade",
                "manual_grade__graded_by",
            )
            .order_by("status", "created_at")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        exam_id = self.request.query_params.get("exam")
        if exam_id:
            queryset = queryset.filter(session__exam_id=exam_id)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(session__candidate__email__icontains=search)
                | Q(session__candidate__full_name__icontains=search)
                | Q(session__exam__name__icontains=search)
                | Q(session_question__question_revision__question_text__icontains=search)
            )
        return queryset

    @action(detail=True, methods=["post"])
    def grade(self, request, pk=None):
        task = self.get_object()
        serializer = ManualGradingTaskGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = grade_manual_task(
            task=task,
            grader=request.user,
            score_awarded=serializer.validated_data["score_awarded"],
            feedback=serializer.validated_data.get("feedback", ""),
        )
        output = ManualGradingTaskSerializer(task)
        return Response(output.data)


class ResultViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ResultSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "results.view",
        "POST": "results.manage",
    }

    def get_queryset(self):
        queryset = (
            Result.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
                "published_by",
            )
            .order_by("-created_at")
        )
        exam_id = self.request.query_params.get("exam")
        if exam_id:
            queryset = queryset.filter(session__exam_id=exam_id)
        publish_state = self.request.query_params.get("publish_state")
        if publish_state:
            queryset = queryset.filter(publish_state=publish_state)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(session__candidate__email__icontains=search)
                | Q(session__candidate__full_name__icontains=search)
                | Q(session__exam__name__icontains=search)
            )
        return queryset

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        finalized = self.get_queryset().filter(workflow_status=Result.WorkflowStatus.FINALIZED)
        pending = self.get_queryset().filter(workflow_status=Result.WorkflowStatus.PENDING_GRADING).count()

        def count_range(lower_exclusive, upper_inclusive):
            filters = Q()
            if lower_exclusive is not None:
                filters &= Q(percentage__gt=Decimal(str(lower_exclusive)))
            if upper_inclusive is not None:
                filters &= Q(percentage__lte=Decimal(str(upper_inclusive)))
            return finalized.filter(filters).count()

        payload = {
            "pass_count": finalized.filter(passed=True).count(),
            "fail_count": finalized.filter(passed=False).count(),
            "pending_count": pending,
            "average_percentage": finalized.aggregate(avg=Avg("percentage"))["avg"] or Decimal("0.00"),
            "score_distribution": [
                {"range": "0-40", "count": count_range(None, 40)},
                {"range": "41-60", "count": count_range(40, 60)},
                {"range": "61-80", "count": count_range(60, 80)},
                {"range": "81-100", "count": count_range(80, None)},
            ],
        }
        serializer = ResultSummarySerializer(payload)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        result = self.get_object()
        result = publish_result(result=result, published_by=request.user)
        output = ResultSerializer(result)
        return Response(output.data, status=status.HTTP_200_OK)

