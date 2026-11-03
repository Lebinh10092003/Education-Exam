from drf_spectacular.types import OpenApiTypes
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics
from rest_framework import mixins, serializers, status, viewsets
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
    create_proctor_evidence,
    get_cached_exam_monitoring_snapshot,
    issue_admin_view_token,
    issue_candidate_publish_token,
    record_heartbeat,
    record_proctor_event,
    register_client_capability,
    resolve_violation_case,
    stop_admin_live_view,
    update_media_status,
    generate_evidence_presigned_url,
    confirm_evidence_upload,
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
    EvidencePresignedUrlRequestSerializer,
    EvidencePresignedUrlResponseSerializer,
    EvidenceConfirmSerializer,
)


def _get_candidate_session(session_id, user):
    # Heartbeat/event deu doc session.exam va lich thi -> lay luon trong 1 query.
    session = get_object_or_404(
        ExamSession.objects.select_related("candidate", "exam", "exam__schedule_window"),
        pk=session_id,
    )
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
        responses={status.HTTP_200_OK: SessionHeartbeatSerializer},
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
        return Response(output.data)


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


class CandidateSessionEvidencePresignedUrlView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=EvidencePresignedUrlRequestSerializer,
        responses={status.HTTP_200_OK: EvidencePresignedUrlResponseSerializer},
    )
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        serializer = EvidencePresignedUrlRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        result = generate_evidence_presigned_url(
            session=session,
            evidence_type=serializer.validated_data["evidence_type"],
            file_name=serializer.validated_data["file_name"],
            content_type=serializer.validated_data["content_type"],
            request=request,
        )
        return Response(result, status=status.HTTP_200_OK)


class CandidateSessionEvidenceConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=EvidenceConfirmSerializer,
        responses={status.HTTP_201_CREATED: ProctorEvidenceSerializer},
    )
    def post(self, request, session_id):
        session = _get_candidate_session(session_id, request.user)
        serializer = EvidenceConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        event = None
        event_id = serializer.validated_data.get("event_id")
        if event_id is not None:
            event = get_object_or_404(ProctorEvent, pk=event_id, session=session)
            
        evidence = confirm_evidence_upload(
            session=session,
            evidence_type=serializer.validated_data["evidence_type"],
            object_key=serializer.validated_data["object_key"],
            metadata=serializer.validated_data.get("metadata", {}),
            uploaded_by=request.user,
            event=event,
        )
        output = ProctorEvidenceSerializer(evidence)
        return Response(output.data, status=status.HTTP_201_CREATED)


class CandidateSessionEvidenceMockUploadView(APIView):
    permission_classes = [IsAuthenticated]
    
    from rest_framework.parsers import BaseParser
    class PlainBinaryParser(BaseParser):
        media_type = '*/*'
        def parse(self, stream, media_type=None, parser_context=None):
            return stream.read()
            
    parser_classes = [PlainBinaryParser]

    @extend_schema(
        request={"application/octet-stream": OpenApiTypes.BINARY},
        responses=inline_serializer(name="EvidenceUploadResponse", fields={"status": serializers.CharField()}),
    )
    def put(self, request, session_id):
        from django.conf import settings
        from django.core.files.base import ContentFile

        from ..evidence_storage import assert_evidence_key_belongs_to_session
        from ..models import select_evidence_storage

        session = get_object_or_404(ExamSession.objects.select_related("candidate"), pk=session_id)
        if session.candidate_id != request.user.id:
            return Response({"detail": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        object_key = request.query_params.get("key")
        if not object_key:
            return Response({"detail": "Missing key parameter."}, status=status.HTTP_400_BAD_REQUEST)
        assert_evidence_key_belongs_to_session(session=session, object_key=object_key)

        # Kiem tra kich thuoc truoc khi doc body vao RAM.
        max_bytes = int(getattr(settings, "PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
        try:
            content_length = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            content_length = 0
        if content_length > max_bytes:
            return Response({"detail": "Evidence file is too large."}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        payload = request.data
        if not isinstance(payload, (bytes, bytearray)) or len(payload) > max_bytes:
            return Response({"detail": "Invalid evidence payload."}, status=status.HTTP_400_BAD_REQUEST)

        file_content = ContentFile(payload)
        select_evidence_storage().save(object_key, file_content)
        
        return Response({"status": "success"}, status=status.HTTP_200_OK)



class CandidateSessionMediaPublishTokenView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={status.HTTP_200_OK: MediaProviderTokenSerializer})
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

    @extend_schema(request=None, responses={status.HTTP_200_OK: MediaProviderTokenSerializer})
    def post(self, request, session_id):
        assert_admin_monitoring_access(user=request.user)
        session = get_object_or_404(
            ExamSession.objects.select_related("candidate", "exam"),
            pk=session_id,
        )
        payload = issue_admin_view_token(session=session, user=request.user)
        return Response(MediaProviderTokenSerializer(payload).data)

    @extend_schema(request=None, responses={status.HTTP_204_NO_CONTENT: None})
    def delete(self, request, session_id):
        assert_admin_monitoring_access(user=request.user)
        session = get_object_or_404(
            ExamSession.objects.select_related("candidate", "exam"),
            pk=session_id,
        )
        stop_admin_live_view(session=session, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExamMonitoringSnapshotView(APIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "proctoring.view"

    @extend_schema(responses={status.HTTP_200_OK: ExamMonitoringSnapshotSerializer})
    def get(self, request, exam_id):
        assert_admin_monitoring_access(user=request.user)
        exam = get_object_or_404(Exam.objects.select_related("subject", "current_version"), pk=exam_id)
        payload = get_cached_exam_monitoring_snapshot(exam=exam)
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
