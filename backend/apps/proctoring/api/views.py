from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exam_authoring.models import Exam
from apps.exam_delivery.models import ExamSession
from apps.identity.permissions import HasAPIPermissionCode

from ..models import ProctorEvent, ViolationCase
from ..services import (
    assert_admin_monitoring_access,
    assert_candidate_session_access,
    build_exam_monitoring_snapshot,
    create_proctor_evidence,
    record_heartbeat,
    record_proctor_event,
    register_client_capability,
    resolve_violation_case,
)
from .serializers import (
    ClientCapabilitySerializer,
    ClientCapabilityWriteSerializer,
    ExamMonitoringSnapshotSerializer,
    ProctorEvidenceCreateSerializer,
    ProctorEvidenceSerializer,
    ProctorEventSerializer,
    ProctorEventWriteSerializer,
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
        queryset = (
            ViolationCase.objects.select_related(
                "session",
                "session__candidate",
                "session__exam",
                "session__exam__subject",
            )
            .prefetch_related("events", "evidences", "reviews", "reviews__reviewer")
            .order_by("status", "-created_at")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        severity_filter = self.request.query_params.get("severity")
        if severity_filter:
            queryset = queryset.filter(severity=severity_filter)
        exam_id = self.request.query_params.get("exam")
        if exam_id:
            queryset = queryset.filter(session__exam_id=exam_id)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(session__candidate__email__icontains=search)
                | Q(session__candidate__full_name__icontains=search)
                | Q(session__exam__name__icontains=search)
                | Q(title__icontains=search)
                | Q(summary__icontains=search)
            )
        return queryset

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
