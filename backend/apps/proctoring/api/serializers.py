import ast
import json

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from django.utils import timezone
from rest_framework import serializers

from apps.platform_core.i18n import t

from ..models import (
    ClientCapability,
    ProctorEvidence,
    ProctorEvent,
    ProctoringMediaState,
    SessionHeartbeat,
    ViolationCase,
    ViolationReview,
)
from ..retention import safe_evidence_file_url


class FlexibleJSONField(serializers.JSONField):
    def to_internal_value(self, data):
        if data in (None, ""):
            return {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                try:
                    data = ast.literal_eval(data)
                except (ValueError, SyntaxError) as exc:
                    raise serializers.ValidationError(
                        t(vi="Du lieu phai la JSON hop le.", en="Must be valid JSON.")
                    ) from exc
        return super().to_internal_value(data)


class ClientCapabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientCapability
        fields = (
            "id",
            "client_type",
            "client_version",
            "capabilities",
            "attestation_payload",
            "user_agent",
            "updated_at",
        )


class ClientCapabilityWriteSerializer(serializers.Serializer):
    client_type = serializers.ChoiceField(choices=ClientCapability.ClientType.choices)
    client_version = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    capabilities = FlexibleJSONField(required=False, default=dict)
    attestation_payload = FlexibleJSONField(required=False, default=dict)
    user_agent = serializers.CharField(required=False, allow_blank=True, default="")


class SessionHeartbeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionHeartbeat
        fields = ("id", "connection_status", "latency_ms", "payload", "recorded_at")


class SessionHeartbeatWriteSerializer(serializers.Serializer):
    connection_status = serializers.ChoiceField(choices=SessionHeartbeat.ConnectionStatus.choices)
    latency_ms = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    payload = FlexibleJSONField(required=False, default=dict)


class ProctorEventSerializer(serializers.ModelSerializer):
    case_ids = serializers.SerializerMethodField()

    class Meta:
        model = ProctorEvent
        fields = ("id", "event_type", "severity", "metadata", "occurred_at", "case_ids")

    @extend_schema_field({"type": "array", "items": {"type": "integer"}})
    def get_case_ids(self, obj):
        return list(obj.violation_cases.values_list("id", flat=True))


class ProctorEventWriteSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=ProctorEvent.EventType.choices)
    severity = serializers.ChoiceField(
        choices=ProctorEvent.Severity.choices,
        required=False,
        default=ProctorEvent.Severity.INFO,
    )
    metadata = FlexibleJSONField(required=False, default=dict)


class ProctorEvidenceSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProctorEvidence
        fields = ("id", "event", "evidence_type", "metadata", "captured_at", "file_url")

    @extend_schema_field(OpenApiTypes.URI)
    def get_file_url(self, obj):
        return safe_evidence_file_url(obj)


class ProctorEvidenceCreateSerializer(serializers.Serializer):
    event_id = serializers.IntegerField(required=False)
    evidence_type = serializers.ChoiceField(choices=ProctorEvidence.EvidenceType.choices)
    metadata = FlexibleJSONField(required=False, default=dict)
    file = serializers.FileField()


class MediaProviderTokenSerializer(serializers.Serializer):
    provider = serializers.CharField()
    server_url = serializers.CharField()
    room_name = serializers.CharField()
    participant_name = serializers.CharField()
    access_token = serializers.CharField()
    expires_at = serializers.CharField()


class ProctoringMediaStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProctoringMediaState
        fields = (
            "provider",
            "room_name",
            "participant_name",
            "webcam_publish_status",
            "screen_capture_status",
            "webcam_publish_error",
            "last_publish_at",
            "last_status_at",
            "metadata",
        )


class ProctoringMediaStateWriteSerializer(serializers.Serializer):
    webcam_publish_status = serializers.ChoiceField(choices=ProctoringMediaState.PublishStatus.choices)
    screen_capture_status = serializers.ChoiceField(choices=ProctoringMediaState.CaptureStatus.choices)
    webcam_publish_error = serializers.CharField(required=False, allow_blank=True, default="")
    metadata = FlexibleJSONField(required=False, default=dict)


class CandidateSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.CharField()
    full_name = serializers.CharField()


class MonitoringExamSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    subject_name = serializers.CharField()


class ExamMonitoringHubItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    subject_name = serializers.CharField(source="subject.name")
    status = serializers.CharField()
    total_candidates = serializers.IntegerField()
    total_sessions = serializers.IntegerField()
    in_progress_sessions = serializers.IntegerField()
    submitted_sessions = serializers.IntegerField()
    alert_count = serializers.IntegerField()
    critical_alert_count = serializers.IntegerField()
    latest_alert_at = serializers.DateTimeField(allow_null=True)
    highest_alert_severity = serializers.SerializerMethodField()

    def get_highest_alert_severity(self, obj):
        if obj.critical_alert_count:
            return "critical"
        if obj.alert_count:
            return "warning"
        return "quiet"


class ExamMonitoringHubSummarySerializer(serializers.Serializer):
    exam_count = serializers.IntegerField()
    total_candidates = serializers.IntegerField()
    in_progress_sessions = serializers.IntegerField()
    alert_count = serializers.IntegerField()
    critical_exam_count = serializers.IntegerField()


class ExamMonitoringHubListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = ExamMonitoringHubItemSerializer(many=True)
    summary = ExamMonitoringHubSummarySerializer()


class MonitoringCandidateStatusSerializer(serializers.Serializer):
    class MediaSerializer(serializers.Serializer):
        webcam_publish_status = serializers.CharField()
        screen_capture_status = serializers.CharField()
        last_publish_at = serializers.CharField(allow_null=True)

    session_id = serializers.IntegerField(allow_null=True)
    candidate = CandidateSummarySerializer()
    status = serializers.CharField()
    progress_percentage = serializers.IntegerField()
    questions_answered = serializers.IntegerField()
    total_questions = serializers.IntegerField()
    time_elapsed_minutes = serializers.IntegerField()
    connection_status = serializers.CharField()
    last_activity_at = serializers.CharField(allow_null=True)
    media = MediaSerializer()


class MonitoringAlertSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    session_id = serializers.IntegerField()
    candidate = CandidateSummarySerializer()
    event_type = serializers.CharField()
    severity = serializers.CharField()
    message = serializers.CharField()
    metadata = serializers.DictField()
    occurred_at = serializers.CharField()
    case_id = serializers.IntegerField(allow_null=True)


class ExamMonitoringSnapshotSerializer(serializers.Serializer):
    exam = MonitoringExamSerializer()
    total_candidates = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    completed = serializers.IntegerField()
    not_started = serializers.IntegerField()
    average_progress = serializers.IntegerField()
    candidate_statuses = MonitoringCandidateStatusSerializer(many=True)
    alerts = MonitoringAlertSerializer(many=True)


class ViolationReviewSerializer(serializers.ModelSerializer):
    reviewer = CandidateSummarySerializer(read_only=True)

    class Meta:
        model = ViolationReview
        fields = ("id", "decision", "notes", "reviewed_at", "reviewer")


class ViolationCaseSerializer(serializers.ModelSerializer):
    class EvidencePreviewSerializer(serializers.Serializer):
        id = serializers.IntegerField()
        evidence_type = serializers.CharField()
        file_url = serializers.CharField()
        captured_at = serializers.CharField()
        deleted_at = serializers.CharField(allow_null=True)

    candidate = serializers.SerializerMethodField()
    exam = serializers.SerializerMethodField()
    event_ids = serializers.SerializerMethodField()
    evidence_ids = serializers.SerializerMethodField()
    evidence_items = serializers.SerializerMethodField()
    reviews = ViolationReviewSerializer(many=True, read_only=True)

    class Meta:
        model = ViolationCase
        fields = (
            "id",
            "session",
            "candidate",
            "exam",
            "severity",
            "status",
            "title",
            "summary",
            "event_ids",
            "evidence_ids",
            "evidence_items",
            "resolved_at",
            "resolution_notes",
            "reviews",
        )

    @extend_schema_field(CandidateSummarySerializer)
    def get_candidate(self, obj):
        candidate = obj.session.candidate
        return {
            "id": candidate.id,
            "email": candidate.email,
            "full_name": candidate.full_name,
        }

    @extend_schema_field(MonitoringExamSerializer)
    def get_exam(self, obj):
        exam = obj.session.exam
        return {
            "id": exam.id,
            "name": exam.name,
            "subject_name": exam.subject.name,
        }

    @extend_schema_field({"type": "array", "items": {"type": "integer"}})
    def get_event_ids(self, obj):
        return list(obj.events.values_list("id", flat=True))

    @extend_schema_field({"type": "array", "items": {"type": "integer"}})
    def get_evidence_ids(self, obj):
        return list(obj.evidences.values_list("id", flat=True))

    @extend_schema_field(EvidencePreviewSerializer(many=True))
    def get_evidence_items(self, obj):
        now = timezone.now()
        evidences = sorted(
            obj.evidences.all(),
            key=lambda evidence: evidence.captured_at,
            reverse=True,
        )[:4]
        return [
            {
                "id": evidence.id,
                "evidence_type": evidence.evidence_type,
                "file_url": safe_evidence_file_url(evidence, now=now),
                "captured_at": evidence.captured_at.isoformat(),
                "deleted_at": evidence.deleted_at.isoformat() if evidence.deleted_at else None,
            }
            for evidence in evidences
        ]


class ViolationCaseResolveSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=ViolationReview.Decision.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
