from rest_framework import serializers

from apps.grading.api.serializers import ResultExamSummarySerializer, ResultUserSummarySerializer

from ..models import ExamCertificateAward, ExamCertificatePolicy, ExamDisciplinaryRecord, ViolationPenaltyProposal


class DisciplinaryExamSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    subject_name = serializers.CharField()
    unique_violating_candidates = serializers.IntegerField()
    total_cases = serializers.IntegerField()
    approved_records = serializers.IntegerField()
    pending_review_count = serializers.IntegerField()
    result_sync_status = serializers.CharField()
    certificate_status = serializers.CharField()
    last_updated = serializers.DateTimeField(allow_null=True)


class ViolationPenaltyProposalSerializer(serializers.ModelSerializer):
    proposed_by = ResultUserSummarySerializer(read_only=True)
    approved_by = ResultUserSummarySerializer(read_only=True)

    class Meta:
        model = ViolationPenaltyProposal
        fields = (
            "proposed_penalty_percent",
            "status",
            "notes",
            "proposed_by",
            "proposed_at",
            "approved_by",
            "approved_at",
        )


class ExamDisciplinaryRecordSerializer(serializers.ModelSerializer):
    candidate = serializers.SerializerMethodField()
    exam = serializers.SerializerMethodField()
    applied_penalty_percent = serializers.DecimalField(
        source="highest_approved_penalty_percent",
        max_digits=5,
        decimal_places=2,
        read_only=True,
    )
    review_status = serializers.SerializerMethodField()

    class Meta:
        model = ExamDisciplinaryRecord
        fields = (
            "id",
            "exam",
            "candidate",
            "selected_session",
            "unique_case_count",
            "open_case_count",
            "approved_case_count",
            "original_total_score",
            "original_percentage",
            "applied_penalty_percent",
            "final_total_score",
            "final_percentage",
            "certificate_level_snapshot",
            "review_status",
            "published_score_synced_at",
            "updated_at",
        )

    def get_candidate(self, obj):
        return {
            "id": obj.candidate_id,
            "email": obj.candidate.email,
            "full_name": obj.candidate.full_name,
        }

    def get_exam(self, obj):
        return {
            "id": obj.exam_id,
            "name": obj.exam.name,
            "subject_name": obj.exam.subject.name,
        }

    def get_review_status(self, obj):
        if obj.highest_approved_penalty_percent > 0:
            return "penalty_applied"
        if obj.unique_case_count == 0:
            return "clear"
        if obj.selected_session_id is None:
            return "pending_review"
        pending_exists = obj.selected_session.violation_cases.filter(
            penalty_proposal__isnull=True,
        ).exists() or obj.selected_session.violation_cases.filter(
            penalty_proposal__status=ViolationPenaltyProposal.Status.DRAFT,
        ).exists()
        return "pending_review" if pending_exists else "reviewed"


class DisciplinaryCaseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    session_id = serializers.IntegerField(source="session_id")
    candidate = ResultUserSummarySerializer(source="session.candidate", read_only=True)
    exam = serializers.SerializerMethodField()
    severity = serializers.CharField()
    status = serializers.CharField()
    title = serializers.CharField()
    summary = serializers.CharField()
    created_at = serializers.DateTimeField()
    evidence_count = serializers.SerializerMethodField()
    proposal = ViolationPenaltyProposalSerializer(source="penalty_proposal", allow_null=True, read_only=True)

    def get_evidence_count(self, obj):
        return obj.evidences.count()

    def get_exam(self, obj):
        exam = obj.session.exam
        return {
            "id": exam.id,
            "name": exam.name,
            "subject_name": exam.subject.name,
        }


class PenaltyProposalMutationSerializer(serializers.Serializer):
    proposed_penalty_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class BulkPenaltyActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("draft", "approve", "reject", "no_penalty"))
    case_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)
    proposed_penalty_percent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CertificatePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamCertificatePolicy
        fields = (
            "mode",
            "gold_config",
            "silver_config",
            "bronze_config",
            "encouragement_config",
        )


class CertificateAwardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamCertificateAward
        fields = ("award_level", "basis_total_score", "basis_percentage", "selected_session", "recomputed_at")
