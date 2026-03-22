import ast
import json

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.platform_core.i18n import t

from ..models import (
    ClientCapability,
    ProctorEvidence,
    ProctorEvent,
    SessionHeartbeat,
    ViolationCase,
    ViolationReview,
)


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
        try:
            return obj.file.url if obj.file else ""
        except ValueError:
            return ""


class ProctorEvidenceCreateSerializer(serializers.Serializer):
    event_id = serializers.IntegerField(required=False)
    evidence_type = serializers.ChoiceField(choices=ProctorEvidence.EvidenceType.choices)
    metadata = FlexibleJSONField(required=False, default=dict)
    file = serializers.FileField()


class CandidateSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.CharField()
    full_name = serializers.CharField()


class MonitoringExamSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    subject_name = serializers.CharField()


class MonitoringCandidateStatusSerializer(serializers.Serializer):
    candidate = CandidateSummarySerializer()
    status = serializers.CharField()
    progress_percentage = serializers.IntegerField()
    questions_answered = serializers.IntegerField()
    total_questions = serializers.IntegerField()
    time_elapsed_minutes = serializers.IntegerField()
    connection_status = serializers.CharField()
    last_activity_at = serializers.CharField(allow_null=True)


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
    candidate = serializers.SerializerMethodField()
    exam = serializers.SerializerMethodField()
    event_ids = serializers.SerializerMethodField()
    evidence_ids = serializers.SerializerMethodField()
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


class ViolationCaseResolveSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=ViolationReview.Decision.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
