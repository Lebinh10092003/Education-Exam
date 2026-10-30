from django.db.models import Count, Exists, F, OuterRef, Q
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasAPIPermissionCode
from apps.institutions.models import CandidateGroup

from ..lifecycle import PHASE_RANKS, annotate_exam_phase, order_exams_by_schedule
from ..models import Exam, ExamAssignment
from ..services import build_exam_assignment_summary, clone_exam, import_students_to_exam, sync_exam_assignments
from .serializers import (
    ExamGroupAssignmentSerializer,
    ExamGroupAssignmentSyncSerializer,
    ExamReadSerializer,
    ExamStudentImportRequestSerializer,
    ExamStudentImportSummarySerializer,
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
                "current_version__items__question_revision__options",
                "current_version__random_rules",
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

        queryset = annotate_exam_phase(queryset)

        # Loc theo trang thai thuc te theo lich (vd. de "dang mo" nhung qua gio dong -> "da ket thuc").
        status_filter = self.request.query_params.get("status")
        if status_filter == Exam.Status.ARCHIVED:
            queryset = queryset.filter(status=status_filter)
        elif status_filter in PHASE_RANKS:
            queryset = queryset.filter(phase_rank=PHASE_RANKS[status_filter])
        elif status_filter:
            queryset = queryset.filter(status=status_filter)

        mode_filter = self.request.query_params.get("mode")
        if mode_filter:
            queryset = queryset.filter(mode=mode_filter)

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)

        ordering = self.request.query_params.get("ordering") or "schedule"
        if ordering == "schedule":
            queryset = order_exams_by_schedule(queryset)
        elif ordering in {"opens_at", "-opens_at"}:
            field = F("schedule_window__opens_at")
            queryset = queryset.order_by(
                field.asc(nulls_last=True) if ordering == "opens_at" else field.desc(nulls_last=True), "-id"
            )
        elif ordering in {"created_at", "-created_at", "name", "-name"}:
            queryset = queryset.order_by(ordering, "-id")
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

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        """
        Xem truoc de nhu thi sinh lam bai (kem dap an/barem de nguoi ra de soat).
        Chi danh cho quyen exams.view - KHONG dung cho phia thi sinh.
        """
        exam = self.get_object()
        version = exam.current_version
        items = []
        if version is not None:
            for item in (
                version.items.select_related(
                    "question_revision", "question_revision__question", "question_revision__answer_key"
                )
                .prefetch_related("question_revision__options")
                .order_by("sort_order")
            ):
                revision = item.question_revision
                answer_key = getattr(revision, "answer_key", None)
                items.append(
                    {
                        "id": item.id,
                        "source": item.source,
                        "sort_order": item.sort_order,
                        "points": str(item.points),
                        "question_id": revision.question_id,
                        "question_type": revision.question.question_type,
                        "difficulty": revision.question.difficulty,
                        "question_text": revision.question_text,
                        "options": [
                            {"key": option.key, "text": option.text}
                            for option in sorted(revision.options.all(), key=lambda option: (option.sort_order, option.key))
                        ],
                        "correct_option_keys": list(getattr(answer_key, "correct_option_keys", []) or []),
                        "essay_rubric": getattr(answer_key, "essay_rubric", "") if answer_key else "",
                        "sample_answer": getattr(answer_key, "sample_answer", "") if answer_key else "",
                    }
                )
        return Response(
            {
                "exam": {
                    "id": exam.id,
                    "name": exam.name,
                    "subject": exam.subject.name,
                    "duration_minutes": exam.duration_minutes,
                    "enable_proctoring": exam.enable_proctoring,
                    "shuffle_questions": exam.shuffle_questions,
                },
                "has_random_rules": bool(version and version.random_rules.exists()),
                "items": items,
            }
        )

    @action(detail=True, methods=["get"], url_path="quality-check")
    def quality_check(self, request, pk=None):
        """Kiem tra de: cau hoi loi, luat ngau nhien thieu cau, lich thi, phan cong thi sinh..."""
        from ..quality import check_exam

        return Response(check_exam(self.get_object()))

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
            queryset = CandidateGroup.objects.annotate(
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
            request=request,
        )
        return Response(build_exam_assignment_summary(exam))

    @extend_schema(
        request=ExamStudentImportRequestSerializer,
        responses={200: ExamStudentImportSummarySerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="student-import",
        parser_classes=[MultiPartParser, FormParser],
    )
    def student_import(self, request, pk=None):
        exam = self.get_object()
        serializer = ExamStudentImportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        summary = import_students_to_exam(
            exam=exam,
            assigned_by=request.user,
            uploaded_file=serializer.validated_data["file"],
        )
        return Response(summary, status=status.HTTP_200_OK)
