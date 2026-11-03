from django.http import HttpResponse
from django.contrib.auth import get_user_model
from django.db.models import Max, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exam_authoring.models import Exam
from apps.identity.permissions import HasAPIPermissionCode
from apps.platform_core.i18n import t
from apps.proctoring.models import ViolationCase

from ..exporters import (
    build_disciplinary_case_workbook,
    build_disciplinary_summary_workbook,
    serialize_workbook,
)
from ..models import ExamCertificatePolicy, ExamDisciplinaryRecord
from ..services import (
    approve_penalty_proposal,
    create_or_update_penalty_proposal,
    mark_case_no_penalty,
    recompute_disciplinary_record,
    recompute_exam_certificates,
    reject_penalty_proposal,
)
from .serializers import (
    BulkPenaltyActionSerializer,
    CertificatePolicySerializer,
    DisciplinaryCaseSerializer,
    DisciplinaryExamSummarySerializer,
    ExamDisciplinaryRecordSerializer,
    PenaltyProposalMutationSerializer,
)


XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
XLSX_SCHEMA_RESPONSE = {(200, XLSX_CONTENT_TYPE): OpenApiTypes.BINARY}
PROPOSAL_STATUS_RESPONSE = inline_serializer(
    name="PenaltyProposalStatusResponse",
    fields={"status": drf_serializers.CharField()},
)


def _get_exam_or_404(exam_id):
    return generics.get_object_or_404(Exam.objects.select_related("subject"), pk=exam_id)


def _build_exam_summary_payload(exam):
    cases = ViolationCase.objects.filter(session__exam=exam)
    record_qs = ExamDisciplinaryRecord.objects.filter(exam=exam)
    last_updated = max(
        [value for value in [exam.updated_at, record_qs.aggregate(value=Max("updated_at"))["value"], getattr(getattr(exam, "certificate_policy", None), "updated_at", None)] if value is not None],
        default=None,
    )
    synced = record_qs.filter(highest_approved_penalty_percent__gt=0, published_score_synced_at__isnull=True).count() == 0
    certificate_status = "configured" if hasattr(exam, "certificate_policy") else "not_configured"
    return {
        "id": exam.id,
        "name": exam.name,
        "subject_name": exam.subject.name,
        "unique_violating_candidates": cases.values("session__candidate_id").distinct().count(),
        "total_cases": cases.count(),
        "approved_records": record_qs.filter(highest_approved_penalty_percent__gt=0).count(),
        "pending_review_count": cases.filter(Q(penalty_proposal__isnull=True) | Q(penalty_proposal__status="draft")).count(),
        "result_sync_status": "synced" if synced else "pending",
        "certificate_status": certificate_status,
        "last_updated": last_updated,
    }


class DisciplineExamSummaryListView(generics.GenericAPIView):
    serializer_class = DisciplinaryExamSummarySerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.view"

    def get(self, request):
        exams = (
            Exam.objects.select_related("subject")
            .filter(sessions__violation_cases__isnull=False)
            .distinct()
            .order_by("-updated_at", "-id")
        )
        payload = [_build_exam_summary_payload(exam) for exam in exams]
        page = self.paginate_queryset(payload)
        serializer = self.get_serializer(page if page is not None else payload, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class DisciplineExamRecordListView(generics.ListAPIView):
    serializer_class = ExamDisciplinaryRecordSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.view"

    def get_queryset(self):
        exam = _get_exam_or_404(self.kwargs["exam_id"])
        user_model = get_user_model()
        candidate_ids = (
            ViolationCase.objects.filter(session__exam=exam)
            .values_list("session__candidate_id", flat=True)
            .distinct()
        )
        for candidate_id in candidate_ids:
            candidate = user_model.objects.get(pk=candidate_id)
            recompute_disciplinary_record(exam=exam, candidate=candidate)
        return (
            ExamDisciplinaryRecord.objects.select_related("exam", "exam__subject", "candidate", "selected_session")
            .filter(exam=exam, unique_case_count__gt=0)
            .order_by("-updated_at", "candidate__full_name", "candidate__email")
        )


class DisciplineExamCaseListView(generics.ListAPIView):
    serializer_class = DisciplinaryCaseSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.view"

    def get_queryset(self):
        exam = _get_exam_or_404(self.kwargs["exam_id"])
        return (
            ViolationCase.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
                "penalty_proposal",
                "penalty_proposal__proposed_by",
                "penalty_proposal__approved_by",
            )
            .prefetch_related("evidences")
            .filter(session__exam=exam)
            .order_by("status", "-created_at")
        )


class CasePenaltyProposalView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.manage"

    @extend_schema(
        request=PenaltyProposalMutationSerializer,
        responses=inline_serializer(
            name="PenaltyProposalResponse",
            fields={"id": drf_serializers.IntegerField(), "status": drf_serializers.CharField()},
        ),
    )
    def post(self, request, case_id):
        case = generics.get_object_or_404(ViolationCase.objects.select_related("session", "session__exam", "session__candidate"), pk=case_id)
        serializer = PenaltyProposalMutationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proposal = create_or_update_penalty_proposal(
            violation_case=case,
            actor=request.user,
            proposed_penalty_percent=serializer.validated_data["proposed_penalty_percent"],
            notes=serializer.validated_data.get("notes", ""),
            request=request,
        )
        return Response({"id": proposal.id, "status": proposal.status}, status=status.HTTP_200_OK)


class CasePenaltyApproveView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.manage"

    @extend_schema(request=PenaltyProposalMutationSerializer, responses=PROPOSAL_STATUS_RESPONSE)
    def post(self, request, case_id):
        case = generics.get_object_or_404(
            ViolationCase.objects.select_related("penalty_proposal", "session", "session__exam", "session__candidate"),
            pk=case_id,
        )
        proposal = getattr(case, "penalty_proposal", None)
        if request.data:
            serializer = PenaltyProposalMutationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            proposal = create_or_update_penalty_proposal(
                violation_case=case,
                actor=request.user,
                proposed_penalty_percent=serializer.validated_data["proposed_penalty_percent"],
                notes=serializer.validated_data.get("notes", ""),
                request=request,
            )
        elif proposal is None:
            return Response(
                {
                    "detail": t(
                        vi="Cần có đề xuất mức phạt trước khi duyệt.",
                        en="Penalty proposal is required before approval.",
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        approve_penalty_proposal(proposal=proposal, approved_by=request.user, request=request)
        return Response({"status": proposal.status})


class CasePenaltyRejectView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.manage"

    @extend_schema(request=None, responses=PROPOSAL_STATUS_RESPONSE)
    def post(self, request, case_id):
        case = generics.get_object_or_404(ViolationCase.objects.select_related("penalty_proposal"), pk=case_id)
        proposal = getattr(case, "penalty_proposal", None)
        if proposal is None:
            return Response(
                {
                    "detail": t(
                        vi="Cần có đề xuất mức phạt trước khi bác bỏ.",
                        en="Penalty proposal is required before rejection.",
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        reject_penalty_proposal(proposal=proposal, rejected_by=request.user, request=request)
        return Response({"status": proposal.status})


class CasePenaltyNoPenaltyView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.manage"

    @extend_schema(request=None, responses=PROPOSAL_STATUS_RESPONSE)
    def post(self, request, case_id):
        case = generics.get_object_or_404(ViolationCase.objects.select_related("penalty_proposal"), pk=case_id)
        proposal = getattr(case, "penalty_proposal", None)
        if proposal is None:
            proposal = create_or_update_penalty_proposal(
                violation_case=case,
                actor=request.user,
                proposed_penalty_percent="0",
                notes="",
                request=request,
            )
        mark_case_no_penalty(proposal=proposal, actor=request.user, request=request)
        return Response({"status": proposal.status})


class DisciplineExamBulkApplyView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.manage"

    @extend_schema(
        request=BulkPenaltyActionSerializer,
        responses=inline_serializer(
            name="BulkPenaltyActionResponse",
            fields={"processed_count": drf_serializers.IntegerField()},
        ),
    )
    def post(self, request, exam_id):
        exam = _get_exam_or_404(exam_id)
        serializer = BulkPenaltyActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cases = list(ViolationCase.objects.filter(session__exam=exam, id__in=serializer.validated_data["case_ids"]).select_related("penalty_proposal"))
        action = serializer.validated_data["action"]
        for case in cases:
            if action == "draft":
                create_or_update_penalty_proposal(
                    violation_case=case,
                    actor=request.user,
                    proposed_penalty_percent=serializer.validated_data.get("proposed_penalty_percent", "0"),
                    notes=serializer.validated_data.get("notes", ""),
                    request=request,
                )
            elif action == "approve":
                proposal = getattr(case, "penalty_proposal", None)
                if proposal is None or "proposed_penalty_percent" in serializer.validated_data:
                    proposal = create_or_update_penalty_proposal(
                        violation_case=case,
                        actor=request.user,
                        proposed_penalty_percent=serializer.validated_data.get(
                            "proposed_penalty_percent",
                            getattr(proposal, "proposed_penalty_percent", "0"),
                        ),
                        notes=serializer.validated_data.get("notes", getattr(proposal, "notes", "")),
                        request=request,
                    )
                approve_penalty_proposal(proposal=proposal, approved_by=request.user, request=request)
            elif action == "reject" and getattr(case, "penalty_proposal", None) is not None:
                reject_penalty_proposal(proposal=case.penalty_proposal, rejected_by=request.user, request=request)
            elif action == "no_penalty":
                proposal = getattr(case, "penalty_proposal", None)
                if proposal is None:
                    proposal = create_or_update_penalty_proposal(
                        violation_case=case,
                        actor=request.user,
                        proposed_penalty_percent="0",
                        notes=serializer.validated_data.get("notes", ""),
                        request=request,
                    )
                mark_case_no_penalty(proposal=proposal, actor=request.user, request=request)
        return Response({"processed_count": len(cases)}, status=status.HTTP_200_OK)


class ExamCertificatePolicyView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.manage"

    @extend_schema(request=CertificatePolicySerializer, responses=CertificatePolicySerializer)
    def put(self, request, exam_id):
        exam = _get_exam_or_404(exam_id)
        serializer = CertificatePolicySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        policy, _ = ExamCertificatePolicy.objects.update_or_create(
            exam=exam,
            defaults={**serializer.validated_data, "updated_by": request.user},
        )
        recompute_exam_certificates(exam=exam, triggered_by=request.user, request=request)
        return Response(CertificatePolicySerializer(policy).data)

    @extend_schema(responses=CertificatePolicySerializer)
    def get(self, request, exam_id):
        exam = _get_exam_or_404(exam_id)
        policy = getattr(exam, "certificate_policy", None)
        if policy is None:
            return Response(
                {
                    "detail": t(
                        vi="Chưa cấu hình chính sách xét giải.",
                        en="Certificate policy is not configured.",
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(CertificatePolicySerializer(policy).data)


class ExamCertificateRecomputeView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.manage"

    @extend_schema(
        request=None,
        responses=inline_serializer(
            name="CertificateRecomputeResponse",
            fields={"award_count": drf_serializers.IntegerField()},
        ),
    )
    def post(self, request, exam_id):
        exam = _get_exam_or_404(exam_id)
        awards = recompute_exam_certificates(exam=exam, triggered_by=request.user, request=request)
        return Response({"award_count": len(awards)}, status=status.HTTP_200_OK)


class DisciplineExamExportView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.view"

    @extend_schema(responses=XLSX_SCHEMA_RESPONSE)
    def get(self, request, exam_id):
        exam = _get_exam_or_404(exam_id)
        records = (
            ExamDisciplinaryRecord.objects.select_related("exam", "exam__subject", "candidate")
            .filter(exam=exam)
            .order_by("candidate__full_name", "candidate__email")
        )
        workbook = build_disciplinary_summary_workbook(records)
        response = HttpResponse(
            serialize_workbook(workbook),
            content_type=XLSX_CONTENT_TYPE,
        )
        response["Content-Disposition"] = f'attachment; filename="eduexam-discipline-summary-exam-{exam.id}.xlsx"'
        return response


class DisciplineExamCaseExportView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "discipline.view"

    @extend_schema(responses=XLSX_SCHEMA_RESPONSE)
    def get(self, request, exam_id):
        exam = _get_exam_or_404(exam_id)
        cases = (
            ViolationCase.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
                "penalty_proposal",
                "penalty_proposal__approved_by",
            )
            .prefetch_related("evidences")
            .filter(session__exam=exam)
            .order_by("status", "-created_at")
        )
        workbook = build_disciplinary_case_workbook(cases)
        response = HttpResponse(
            serialize_workbook(workbook),
            content_type=XLSX_CONTENT_TYPE,
        )
        response["Content-Disposition"] = f'attachment; filename="eduexam-discipline-cases-exam-{exam.id}.xlsx"'
        return response
