from decimal import Decimal
from datetime import datetime
from io import BytesIO

from django.contrib.auth import get_user_model
from django.db.models import Avg, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from openpyxl import Workbook
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.exam_authoring.models import Exam, ExamAssignment
from apps.identity.permissions import HasAPIPermissionCode
from apps.institutions.models import GroupMembership

from ..models import ManualGradingTask, Result
from ..services import grade_manual_task, publish_result
from .serializers import (
    ManualGradingTaskGradeSerializer,
    ManualGradingTaskSerializer,
    ResultReviewSerializer,
    ResultSerializer,
    ResultSummarySerializer,
    PublicResultSerializer,
)


EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _serialize_workbook(workbook):
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _xlsx_response(workbook, filename):
    response = HttpResponse(_serialize_workbook(workbook), content_type=EXCEL_CONTENT_TYPE)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _write_sheet(sheet, headers, rows):
    sheet.append(headers)
    for row in rows:
        sheet.append([_excel_value(value) for value in row])
    for column_cells in sheet.columns:
        max_length = max(len(str(cell.value or "")) for cell in column_cells)
        sheet.column_dimensions[column_cells[0].column_letter].width = min(max(max_length + 2, 12), 48)


def _excel_value(value):
    if isinstance(value, datetime) and timezone.is_aware(value):
        return timezone.localtime(value).replace(tzinfo=None)
    return value


def _candidate_profile(user):
    return getattr(user, "profile", None)


def _candidate_roster_values(user):
    profile = _candidate_profile(user)
    school = getattr(profile, "school", None) if profile else None
    return [
        user.full_name,
        getattr(profile, "date_of_birth", "") or "",
        getattr(school, "name", "") or "",
        getattr(profile, "ward", "") or "",
        getattr(profile, "national_exam_subject", "") or "",
        getattr(profile, "exam_block", "") or "",
        getattr(profile, "candidate_number", "") or "",
        user.email,
        getattr(profile, "phone_number", "") or "",
        user.username,
        getattr(profile, "visible_password", "") or "",
    ]


def _result_row(result):
    candidate = result.session.candidate
    exam = result.session.exam
    return [
        candidate.full_name,
        candidate.email,
        candidate.username,
        exam.name,
        exam.subject.name,
        result.total_score,
        result.original_total_score,
        result.max_score,
        result.percentage,
        result.original_percentage,
        result.penalty_percent_applied,
        result.workflow_status,
        result.publish_state,
        result.session.submitted_at,
        result.session.attempt_number,
    ]


def _result_export_workbook(results):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Kết quả"
    _write_sheet(
        sheet,
        [
            "Thí sinh",
            "Email",
            "Tài khoản",
            "Kỳ thi",
            "Môn thi",
            "Điểm",
            "Điểm gốc",
            "Tổng điểm",
            "Tỷ lệ %",
            "Tỷ lệ gốc %",
            "Phạt %",
            "Trạng thái chấm",
            "Trạng thái công bố",
            "Thời gian nộp",
            "Lần thi",
        ],
        [_result_row(result) for result in results],
    )
    return workbook


def _assigned_exam_candidates(exam):
    group_ids = ExamAssignment.objects.filter(exam=exam, group__isnull=False).values_list("group_id", flat=True)
    direct_user_ids = ExamAssignment.objects.filter(exam=exam, user__isnull=False).values_list("user_id", flat=True)
    group_user_ids = GroupMembership.objects.filter(
        group_id__in=group_ids,
        is_active=True,
    ).values_list("user_id", flat=True)
    user_ids = set(direct_user_ids) | set(group_user_ids)
    User = get_user_model()
    return (
        User.objects.filter(id__in=user_ids)
        .select_related("profile", "profile__school")
        .order_by("full_name", "email", "username")
    )


ROSTER_HEADERS = [
    "STT",
    "Họ tên",
    "Ngày sinh",
    "Trường",
    "Xã/Phường",
    "Môn thi đăng ký",
    "Khối thi",
    "SBD",
    "Email liên lạc",
    "SĐT liên lạc",
    "Tài khoản",
    "Mật khẩu",
    "Kỳ thi",
    "Môn kỳ thi",
    "Trạng thái",
    "Điểm",
    "Tỷ lệ %",
    "Thời gian nộp",
]


def _exam_roster_workbook(exam):
    candidates = list(_assigned_exam_candidates(exam))
    results = list(
        Result.objects.select_related("session", "session__candidate", "session__exam", "session__exam__subject")
        .filter(session__exam=exam)
        .order_by("session__candidate__full_name", "session__candidate__email", "session__attempt_number")
    )
    latest_result_by_candidate = {}
    for result in results:
        latest_result_by_candidate[result.session.candidate_id] = result

    workbook = Workbook()
    result_sheet = workbook.active
    result_sheet.title = "Kết quả"
    _write_sheet(result_sheet, ROSTER_HEADERS, [
        [
            index,
            *_candidate_roster_values(result.session.candidate),
            exam.name,
            exam.subject.name,
            result.workflow_status,
            result.total_score,
            result.percentage,
            result.session.submitted_at,
        ]
        for index, result in enumerate(results, start=1)
    ])

    submitted_sheet = workbook.create_sheet("Đã thi")
    submitted_candidates = [
        candidate
        for candidate in candidates
        if candidate.id in latest_result_by_candidate
    ]
    _write_sheet(submitted_sheet, ROSTER_HEADERS, [
        [
            index,
            *_candidate_roster_values(candidate),
            exam.name,
            exam.subject.name,
            "Đã nộp",
            latest_result_by_candidate[candidate.id].total_score,
            latest_result_by_candidate[candidate.id].percentage,
            latest_result_by_candidate[candidate.id].session.submitted_at,
        ]
        for index, candidate in enumerate(submitted_candidates, start=1)
    ])

    not_submitted_sheet = workbook.create_sheet("Chưa thi")
    sessions_by_candidate = {
        session.candidate_id: session
        for session in exam.sessions.select_related("candidate").exclude(candidate_id__in=latest_result_by_candidate)
    }
    not_submitted_candidates = [
        candidate
        for candidate in candidates
        if candidate.id not in latest_result_by_candidate
    ]
    _write_sheet(not_submitted_sheet, ROSTER_HEADERS, [
        [
            index,
            *_candidate_roster_values(candidate),
            exam.name,
            exam.subject.name,
            getattr(sessions_by_candidate.get(candidate.id), "status", "Chưa bắt đầu"),
            "",
            "",
            getattr(sessions_by_candidate.get(candidate.id), "submitted_at", "") or "",
        ]
        for index, candidate in enumerate(not_submitted_candidates, start=1)
    ])

    return workbook


def _exam_unsubmitted_workbook(exam):
    candidates = list(_assigned_exam_candidates(exam))
    submitted_user_ids = set(
        Result.objects.filter(session__exam=exam).values_list("session__candidate_id", flat=True)
    )
    unsubmitted_candidates = [
        c for c in candidates if c.id not in submitted_user_ids
    ]
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Chưa thi"
    headers = ["STT", "Họ tên", "Email", "Tài khoản", "Trạng thái"]
    rows = [
        [
            index,
            c.full_name,
            c.email,
            c.username,
            "Chưa thi"
        ]
        for index, c in enumerate(unsubmitted_candidates, start=1)
    ]
    _write_sheet(sheet, headers, rows)
    return workbook


def _review_workbook(result):
    review = ResultReviewSerializer(result).data
    workbook = Workbook()
    overview = workbook.active
    overview.title = "Tổng quan"
    candidate = review["candidate"]
    exam = review["exam"]
    result_data = review["result"]
    _write_sheet(
        overview,
        ["Trường", "Giá trị"],
        [
            ["Thí sinh", candidate["full_name"]],
            ["Email", candidate["email"]],
            ["Tài khoản", candidate["username"]],
            ["Kỳ thi", exam["name"]],
            ["Môn thi", exam["subject_name"]],
            ["Điểm", result_data["score"]],
            ["Tổng điểm", result_data["total_marks"]],
            ["Tỷ lệ %", result_data["percentage"]],
            ["Trạng thái", result_data["result_status"]],
        ],
    )

    answers = workbook.create_sheet("Bài làm")
    _write_sheet(
        answers,
        [
            "STT",
            "Câu hỏi",
            "Loại",
            "Đáp án thí sinh",
            "Đáp án đúng",
            "Điểm tối đa",
            "Điểm đạt",
            "Đúng/Sai",
            "Feedback tự luận",
        ],
        [
            [
                question["sort_order"],
                question["question_text"],
                question["question_type"],
                ", ".join(question["selected_option_keys"]) or question["answer_text"],
                ", ".join(question["correct_option_keys"]) or question["sample_answer"],
                question["points"],
                question["awarded_points"] or question["manual_score_awarded"] or "",
                question["is_correct"],
                question["manual_feedback"],
            ]
            for question in review["questions"]
        ],
    )
    return workbook


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
            request=request,
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
        result = publish_result(result=result, published_by=request.user, request=request)
        output = ResultSerializer(result)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-publish")
    def bulk_publish(self, request):
        exam_id = request.data.get("exam_id")
        if not exam_id:
            return Response({"detail": "exam_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        results = Result.objects.select_related("session").filter(
            session__exam_id=exam_id,
            workflow_status=Result.WorkflowStatus.FINALIZED,
            publish_state=Result.PublishState.DRAFT,
        )

        count = 0
        for result in results:
            try:
                publish_result(result=result, published_by=request.user, request=request)
                count += 1
            except ValidationError:
                continue

        return Response(
            {
                "detail": f"Successfully published {count} finalized result(s).",
                "published_count": count,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="review")
    def review(self, request, pk=None):
        result = (
            Result.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
                "published_by",
            )
            .prefetch_related(
                "session__questions__question_revision__question",
                "session__questions__question_revision__options",
                "session__questions__question_revision__answer_key",
                "session__questions__answer",
                "session__questions__manual_grading_task__manual_grade",
            )
            .get(pk=self.get_object().pk)
        )
        output = ResultReviewSerializer(result)
        return Response(output.data)

    @action(detail=True, methods=["get"], url_path="review-export")
    def review_export(self, request, pk=None):
        result = (
            Result.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
            )
            .prefetch_related(
                "session__questions__question_revision__question",
                "session__questions__question_revision__options",
                "session__questions__question_revision__answer_key",
                "session__questions__answer",
                "session__questions__manual_grading_task__manual_grade",
            )
            .get(pk=self.get_object().pk)
        )
        return _xlsx_response(_review_workbook(result), f"eduexam-result-review-{result.id}.xlsx")

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        import csv

        queryset = self.filter_queryset(self.get_queryset())
        data = ResultSerializer(queryset, many=True).data

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response.write(b"\xef\xbb\xbf")  # UTF-8 BOM
        response["Content-Disposition"] = 'attachment; filename="eduexam-results.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "Candidate",
            "Candidate Email",
            "Exam",
            "Subject",
            "Score",
            "Original Score",
            "Total Marks",
            "Percentage",
            "Original Percentage",
            "Penalty Percent",
            "Certificate",
            "Workflow Status",
            "Publish State",
            "Completed Date",
            "Time Taken (minutes)",
        ])

        for item in data:
            candidate = item.get("candidate") or {}
            exam = item.get("exam") or {}
            writer.writerow([
                candidate.get("full_name") or "",
                candidate.get("email") or "",
                exam.get("name") or "",
                exam.get("subject_name") or "",
                item.get("score") or "0.00",
                item.get("original_score") or "0.00",
                item.get("total_marks") or "0.00",
                item.get("percentage") or "0.00",
                item.get("original_percentage") or "0.00",
                item.get("penalty_percent_applied") or "0.00",
                item.get("certificate_level") or "",
                item.get("workflow_status") or "",
                item.get("publish_state") or "",
                item.get("completed_date") or "",
                item.get("time_taken_minutes") or 0,
            ])

        return response

    @action(detail=False, methods=["get"], url_path="export-xlsx")
    def export_xlsx(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return _xlsx_response(_result_export_workbook(queryset), "eduexam-results.xlsx")

    @action(detail=False, methods=["get"], url_path="exam-roster-export")
    def exam_roster_export(self, request):
        exam_id = request.query_params.get("exam")
        if not exam_id:
            return Response({"detail": "exam is required."}, status=status.HTTP_400_BAD_REQUEST)
        exam = get_object_or_404(Exam.objects.select_related("subject"), pk=exam_id)
        return _xlsx_response(_exam_roster_workbook(exam), f"eduexam-exam-roster-{exam.id}.xlsx")

    @action(detail=False, methods=["get"], url_path="exam-unsubmitted-export")
    def exam_unsubmitted_export(self, request):
        exam_id = request.query_params.get("exam")
        if not exam_id:
            return Response({"detail": "exam is required."}, status=status.HTTP_400_BAD_REQUEST)
        exam = get_object_or_404(Exam, pk=exam_id)
        return _xlsx_response(_exam_unsubmitted_workbook(exam), f"eduexam-unsubmitted-{exam.id}.xlsx")

    @action(detail=False, methods=["get"], url_path="candidates")
    def candidates(self, request):
        exam_id = request.query_params.get("exam")
        if not exam_id:
            return Response({"detail": "exam is required."}, status=status.HTTP_400_BAD_REQUEST)
        exam = get_object_or_404(Exam, pk=exam_id)
        candidates = _assigned_exam_candidates(exam)
        submitted_user_ids = set(
            Result.objects.filter(session__exam=exam).values_list("session__candidate_id", flat=True)
        )
        results = []
        for c in candidates:
            results.append({
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "username": c.username,
                "has_submitted": c.id in submitted_user_ids,
            })
        return Response(results)



class CandidateResultListView(generics.ListAPIView):
    serializer_class = ResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            Result.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
                "published_by",
            )
            .filter(
                session__candidate=self.request.user,
                publish_state=Result.PublishState.PUBLISHED,
                session__exam__status__in=[Exam.Status.CLOSED, Exam.Status.ARCHIVED],
            )
            .order_by("-published_at", "-created_at")
        )
        exam_id = self.request.query_params.get("exam")
        if exam_id:
            queryset = queryset.filter(session__exam_id=exam_id)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(session__exam__name__icontains=search)
                | Q(session__exam__subject__name__icontains=search)
                | Q(session__exam__subject__code__icontains=search)
            )
        return queryset


class PublicResultLookupView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicResultSerializer

    def get_queryset(self):
        lookup_type = self.request.query_params.get("type", "personal")
        queryset = Result.objects.select_related(
            "session",
            "session__candidate",
            "session__exam",
            "session__exam__subject",
        ).filter(
            publish_state=Result.PublishState.PUBLISHED,
            session__exam__status__in=[Exam.Status.CLOSED, Exam.Status.ARCHIVED],
        )

        if lookup_type == "username":
            username = self.request.query_params.get("username", "").strip()
            if not username:
                return Result.objects.none()
            queryset = queryset.filter(session__candidate__username__iexact=username)

        elif lookup_type == "personal":
            full_name = self.request.query_params.get("full_name", "").strip()
            date_of_birth_str = self.request.query_params.get("date_of_birth", "").strip()
            phone_number = self.request.query_params.get("phone_number", "").strip()

            if not full_name or not date_of_birth_str or not phone_number:
                return Result.objects.none()

            parsed_dob = None
            for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
                try:
                    parsed_dob = datetime.strptime(date_of_birth_str, fmt).date()
                    break
                except ValueError:
                    continue

            if not parsed_dob:
                return Result.objects.none()

            queryset = queryset.filter(
                session__candidate__full_name__iexact=full_name,
                session__candidate__profile__date_of_birth=parsed_dob,
                session__candidate__profile__phone_number=phone_number,
            )
        else:
            return Result.objects.none()

        return queryset


