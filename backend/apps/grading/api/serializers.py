from decimal import Decimal

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ..models import ManualGrade, ManualGradingTask, Result


class ResultUserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.CharField()
    full_name = serializers.CharField()


class ResultExamSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    subject_name = serializers.CharField()


class ManualGradeSerializer(serializers.ModelSerializer):
    graded_by = ResultUserSummarySerializer(read_only=True)

    class Meta:
        model = ManualGrade
        fields = ("score_awarded", "feedback", "graded_at", "graded_by")


class ManualGradingTaskSerializer(serializers.ModelSerializer):
    candidate = serializers.SerializerMethodField()
    exam = serializers.SerializerMethodField()
    question_text = serializers.CharField(source="session_question.question_revision.question_text", read_only=True)
    answer_text = serializers.SerializerMethodField()
    manual_grade = ManualGradeSerializer(read_only=True)

    class Meta:
        model = ManualGradingTask
        fields = (
            "id",
            "status",
            "max_points",
            "question_text",
            "answer_text",
            "candidate",
            "exam",
            "graded_at",
            "manual_grade",
        )

    @extend_schema_field(ResultUserSummarySerializer)
    def get_candidate(self, obj):
        candidate = obj.session.candidate
        return {
            "id": candidate.id,
            "email": candidate.email,
            "full_name": candidate.full_name,
        }

    @extend_schema_field(ResultExamSummarySerializer)
    def get_exam(self, obj):
        exam = obj.session.exam
        return {
            "id": exam.id,
            "name": exam.name,
            "subject_name": exam.subject.name,
        }

    @extend_schema_field(OpenApiTypes.STR)
    def get_answer_text(self, obj):
        answer = getattr(obj.session_question, "answer", None)
        return getattr(answer, "answer_text", "")


class ManualGradingTaskGradeSerializer(serializers.Serializer):
    score_awarded = serializers.DecimalField(max_digits=8, decimal_places=2)
    feedback = serializers.CharField(required=False, allow_blank=True)


class ResultSerializer(serializers.ModelSerializer):
    candidate = serializers.SerializerMethodField()
    exam = serializers.SerializerMethodField()
    score = serializers.DecimalField(source="total_score", max_digits=8, decimal_places=2, read_only=True)
    total_marks = serializers.DecimalField(source="max_score", max_digits=8, decimal_places=2, read_only=True)
    result_status = serializers.SerializerMethodField()
    completed_date = serializers.DateTimeField(source="session.submitted_at", read_only=True)
    time_taken_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = (
            "id",
            "candidate",
            "exam",
            "workflow_status",
            "publish_state",
            "score",
            "total_marks",
            "percentage",
            "result_status",
            "passed",
            "completed_date",
            "time_taken_minutes",
            "published_at",
        )

    @extend_schema_field(ResultUserSummarySerializer)
    def get_candidate(self, obj):
        candidate = obj.session.candidate
        return {
            "id": candidate.id,
            "email": candidate.email,
            "full_name": candidate.full_name,
        }

    @extend_schema_field(ResultExamSummarySerializer)
    def get_exam(self, obj):
        exam = obj.session.exam
        return {
            "id": exam.id,
            "name": exam.name,
            "subject_name": exam.subject.name,
        }

    @extend_schema_field(OpenApiTypes.STR)
    def get_result_status(self, obj):
        if obj.workflow_status != Result.WorkflowStatus.FINALIZED:
            return "Pending"
        return "Pass" if obj.passed else "Fail"

    @extend_schema_field(OpenApiTypes.INT)
    def get_time_taken_minutes(self, obj):
        if not obj.session.submitted_at:
            return 0
        delta = obj.session.submitted_at - obj.session.started_at
        return max(0, int(delta.total_seconds() // 60))


class ScoreDistributionBucketSerializer(serializers.Serializer):
    range = serializers.CharField()
    count = serializers.IntegerField()


class ResultSummarySerializer(serializers.Serializer):
    pass_count = serializers.IntegerField()
    fail_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    average_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    score_distribution = ScoreDistributionBucketSerializer(many=True)

