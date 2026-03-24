from drf_spectacular.types import OpenApiTypes
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exam_authoring.models import Exam
from apps.exam_delivery.models import ExamSession
from apps.identity.permissions import HasAPIPermissionCode

from ..exporters import build_violation_cases_workbook, serialize_workbook
from ..models import ProctorEvent
from ..services import (
    assert_admin_monitoring_access,
    assert_candidate_session_access,
    build_exam_monitoring_snapshot,
    create_proctor_evidence,
    issue_admin_view_token,
    issue_candidate_publish_token,
    record_heartbeat,
    record_proctor_event,
    register_client_capability,
    resolve_violation_case,
    update_media_status,
)
from .querysets import build_exam_monitoring_hub_queryset, build_exam_monitoring_hub_summary, build_violation_case_queryset
from .serializers import (
    ClientCapabilitySerializer,
    ClientCapabilityWriteSerializer,
    ExamMonitoringHubItemSerializer,
    ExamMonitoringHubListResponseSerializer,
    ExamMonitoringSnapshotSerializer,
    MediaProviderTokenSerializer,
    ProctorEvidenceCreateSerializer,
    ProctorEvidenceSerializer,
    ProctorEventSerializer,
    ProctorEventWriteSerializer,
    ProctoringMediaStateSerializer,
    ProctoringMediaStateWriteSerializer,
    SessionHeartbeatSerializer,
    SessionHeartbeatWriteSerializer,
    ViolationCaseResolveSerializer,
    ViolationCaseSerializer,
)


def _get_candidate_session(session_id, user):
    session = get_object_or_404(ExamSession.objects.select_related("candidate"), pk=session_id)
    return assert_candidate_session_access(session=session, user=user)


class CandidateSessionCapabilityView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ClientCapabilityWriteSerializer,
        responses={status.HTTP_200_OK: ClientCapabilitySerializer},
    )
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        serializer = ClientCapabilityWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        capability = register_client_capability(
            session=session,
            **serializer.validated_data,
        )
        output = ClientCapabilitySerializer(capability)
        return Response(output.data)


class CandidateSessionHeartbeatView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SessionHeartbeatWriteSerializer,
        responses={status.HTTP_201_CREATED: SessionHeartbeatSerializer},
    )
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        serializer = SessionHeartbeatWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        heartbeat = record_heartbeat(
            session=session,
            reported_by=request.user,
            **serializer.validated_data,
        )
        output = SessionHeartbeatSerializer(heartbeat)
        return Response(output.data, status=status.HTTP_201_CREATED)


class CandidateSessionEventView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ProctorEventWriteSerializer,
        responses={status.HTTP_201_CREATED: ProctorEventSerializer},
    )
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        serializer = ProctorEventWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = record_proctor_event(
            session=session,
            reported_by=request.user,
            **serializer.validated_data,
        )
        output = ProctorEventSerializer(event)
        return Response(output.data, status=status.HTTP_201_CREATED)


class CandidateSessionEvidenceView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=ProctorEvidenceCreateSerializer,
        responses={status.HTTP_201_CREATED: ProctorEvidenceSerializer},
    )
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        serializer = ProctorEvidenceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = None
        event_id = serializer.validated_data.get("event_id")
        if event_id is not None:
            event = get_object_or_404(ProctorEvent, pk=event_id, session=session)
        evidence = create_proctor_evidence(
            session=session,
            evidence_type=serializer.validated_data["evidence_type"],
            file=serializer.validated_data["file"],
            metadata=serializer.validated_data.get("metadata", {}),
            uploaded_by=request.user,
            event=event,
        )
        output = ProctorEvidenceSerializer(evidence)
        return Response(output.data, status=status.HTTP_201_CREATED)


class CandidateSessionMediaPublishTokenView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={status.HTTP_200_OK: MediaProviderTokenSerializer})
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        payload = issue_candidate_publish_token(session=session, user=request.user)
        return Response(MediaProviderTokenSerializer(payload).data)


class CandidateSessionMediaStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ProctoringMediaStateWriteSerializer,
        responses={status.HTTP_200_OK: ProctoringMediaStateSerializer},
    )
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        serializer = ProctoringMediaStateWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        media_state = update_media_status(
            session=session,
            **serializer.validated_data,
        )
        return Response(ProctoringMediaStateSerializer(media_state).data)


class AdminSessionMediaViewTokenView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "proctoring.view"

    @extend_schema(responses={status.HTTP_200_OK: MediaProviderTokenSerializer})
    def post(self, request, session_id):
        assert_admin_monitoring_access(user=request.user)
        session = get_object_or_404(
            ExamSession.objects.select_related("candidate", "exam"),
            pk=session_id,
        )
        payload = issue_admin_view_token(session=session, user=request.user)
        return Response(MediaProviderTokenSerializer(payload).data)


class ExamMonitoringSnapshotView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "proctoring.view"

    @extend_schema(responses={status.HTTP_200_OK: ExamMonitoringSnapshotSerializer})
    def get(self, request, exam_id):
        assert_admin_monitoring_access(user=request.user)
        exam = get_object_or_404(Exam.objects.select_related("subject", "current_version"), pk=exam_id)
        payload = build_exam_monitoring_snapshot(exam=exam)
        serializer = ExamMonitoringSnapshotSerializer(payload)
        return Response(serializer.data)


class ExamMonitoringHubListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "proctoring.view"
    serializer_class = ExamMonitoringHubItemSerializer

    @extend_schema(responses={status.HTTP_200_OK: ExamMonitoringHubListResponseSerializer})
    def get(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = build_exam_monitoring_hub_summary(queryset)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data["summary"] = summary
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "count": len(serializer.data),
                "next": None,
                "previous": None,
                "results": serializer.data,
                "summary": summary,
            }
        )

    def get_queryset(self):
        assert_admin_monitoring_access(user=self.request.user)
        return build_exam_monitoring_hub_queryset(self.request)


class ViolationCaseExportView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "proctoring.view"

    @extend_schema(responses={status.HTTP_200_OK: OpenApiTypes.BINARY})
    def get(self, request):
        assert_admin_monitoring_access(user=request.user)

        exam_id = request.query_params.get("exam")
        if not exam_id:
            return Response({"detail": "exam is required."}, status=status.HTTP_400_BAD_REQUEST)

        workbook = build_violation_cases_workbook(build_violation_case_queryset(request))
        payload = serialize_workbook(workbook)
        response = HttpResponse(
            payload,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="eduexam-violation-history-exam-{exam_id}.xlsx"'
        return response


class ViolationCaseViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ViolationCaseSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_codes = {
        "GET": "proctoring.view",
        "POST": "proctoring.manage",
    }

    def get_queryset(self):
        return build_violation_case_queryset(self.request)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        case = self.get_object()
        serializer = ViolationCaseResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = resolve_violation_case(
            case=case,
            reviewer=request.user,
            decision=serializer.validated_data["decision"],
            notes=serializer.validated_data.get("notes", ""),
            request=request,
        )
        output = ViolationCaseSerializer(case)
        return Response(output.data)
