from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.exam_authoring.models import Exam
from apps.grading.api.serializers import ResultSerializer
from apps.materials.api.serializers import MaterialSerializer
from apps.question_bank.models import QuestionOption

from ..models import AutosaveSnapshot, ExamSession, SessionAnswer, SessionQuestion
from ..services import get_remaining_seconds


class CandidateExamSubjectSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    code = serializers.CharField()
    color = serializers.CharField()


class CandidateExamScheduleSerializer(serializers.Serializer):
    opens_at = serializers.DateTimeField(allow_null=True)
    closes_at = serializers.DateTimeField(allow_null=True)


class CandidateAssignedExamSerializer(serializers.ModelSerializer):
    subject = CandidateExamSubjectSerializer(read_only=True)
    schedule = serializers.SerializerMethodField()
    attempts_used = serializers.SerializerMethodField()
    attempts_remaining = serializers.SerializerMethodField()
    active_session_id = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()
    enable_proctoring = serializers.BooleanField(read_only=True)

    class Meta:
        model = Exam
        fields = (
            "id",
            "name",
            "description",
            "status",
            "duration_minutes",
            "passing_score",
            "max_attempts",
            "subject",
            "schedule",
            "attempts_used",
            "attempts_remaining",
            "active_session_id",
            "question_count",
            "enable_proctoring",
        )

    @extend_schema_field(CandidateExamScheduleSerializer)
    def get_schedule(self, obj):
        schedule_window = getattr(obj, "schedule_window", None)
        if schedule_window is None:
            return {"opens_at": None, "closes_at": None}
        return {
            "opens_at": schedule_window.opens_at,
            "closes_at": schedule_window.closes_at,
        }

    @extend_schema_field(OpenApiTypes.INT)
    def get_attempts_used(self, obj):
        request = self.context["request"]
        return obj.sessions.filter(candidate=request.user).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_attempts_remaining(self, obj):
        return max(0, obj.max_attempts - self.get_attempts_used(obj))

    @extend_schema_field(OpenApiTypes.INT)
    def get_active_session_id(self, obj):
        request = self.context["request"]
        session = (
            obj.sessions.filter(candidate=request.user, status=ExamSession.Status.IN_PROGRESS)
            .order_by("-attempt_number")
            .first()
        )
        return session.id if session else None

    @extend_schema_field(OpenApiTypes.INT)
    def get_question_count(self, obj):
        current_version = getattr(obj, "current_version", None)
        if current_version is None:
            return 0
        return current_version.items.count()


class SessionQuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ("key", "text", "sort_order")


class SessionQuestionSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="question_revision.question_text", read_only=True)
    question_type = serializers.CharField(source="question_revision.question.question_type", read_only=True)
    difficulty = serializers.CharField(source="question_revision.question.difficulty", read_only=True)
    options = SessionQuestionOptionSerializer(source="question_revision.options", many=True, read_only=True)
    selected_option_keys = serializers.SerializerMethodField()
    answer_text = serializers.SerializerMethodField()
    is_answered = serializers.SerializerMethodField()

    class Meta:
        model = SessionQuestion
        fields = (
            "id",
            "sort_order",
            "points",
            "question_text",
            "question_type",
            "difficulty",
            "options",
            "selected_option_keys",
            "answer_text",
            "is_answered",
            "is_marked_for_review",
        )

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_selected_option_keys(self, obj):
        answer = getattr(obj, "answer", None)
        return getattr(answer, "selected_option_keys", [])

    @extend_schema_field(OpenApiTypes.STR)
    def get_answer_text(self, obj):
        answer = getattr(obj, "answer", None)
        return getattr(answer, "answer_text", "")

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_answered(self, obj):
        answer = getattr(obj, "answer", None)
        return getattr(answer, "is_answered", False)


class CandidateExamSessionSerializer(serializers.ModelSerializer):
    exam_name = serializers.CharField(source="exam.name", read_only=True)
    subject = CandidateExamSubjectSerializer(source="exam.subject", read_only=True)
    show_results_immediately = serializers.BooleanField(source="exam.show_results_immediately", read_only=True)
    enable_proctoring = serializers.BooleanField(source="exam.enable_proctoring", read_only=True)
    remaining_seconds = serializers.SerializerMethodField()
    answered_count = serializers.SerializerMethodField()
    marked_count = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    questions = SessionQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = ExamSession
        fields = (
            "id",
            "exam_id",
            "exam_name",
            "subject",
            "status",
            "attempt_number",
            "started_at",
            "expires_at",
            "submitted_at",
            "show_results_immediately",
            "enable_proctoring",
            "remaining_seconds",
            "objective_score",
            "max_score",
            "manual_grading_required",
            "answered_count",
            "marked_count",
            "total_questions",
            "questions",
        )

    @extend_schema_field(OpenApiTypes.INT)
    def get_remaining_seconds(self, obj):
        return get_remaining_seconds(obj)

    @extend_schema_field(OpenApiTypes.INT)
    def get_answered_count(self, obj):
        return obj.questions.filter(answer__is_answered=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_marked_count(self, obj):
        return obj.questions.filter(is_marked_for_review=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_total_questions(self, obj):
        return obj.questions.count()


class SessionAnswerWriteSerializer(serializers.Serializer):
    selected_option_keys = serializers.ListField(child=serializers.CharField(), required=False)
    answer_text = serializers.CharField(required=False, allow_blank=True)
    is_marked_for_review = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("At least one field must be provided.")
        return attrs


class SessionAnswerResponseSerializer(serializers.ModelSerializer):
    is_marked_for_review = serializers.BooleanField(source="session_question.is_marked_for_review", read_only=True)

    class Meta:
        model = SessionAnswer
        fields = (
            "session_question",
            "selected_option_keys",
            "answer_text",
            "is_answered",
            "is_marked_for_review",
            "updated_at",
        )


class AutosaveSnapshotWriteSerializer(serializers.Serializer):
    payload = serializers.JSONField(required=False)


class AutosaveSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutosaveSnapshot
        fields = ("id", "answered_count", "marked_count", "payload", "created_at")


class SessionSubmissionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSession
        fields = (
            "id",
            "status",
            "submitted_at",
            "objective_score",
            "max_score",
            "manual_grading_required",
        )


class CandidateDashboardStatsSerializer(serializers.Serializer):
    assigned_exam_count = serializers.IntegerField()
    upcoming_exam_count = serializers.IntegerField()
    published_result_count = serializers.IntegerField()
    average_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    active_material_count = serializers.IntegerField()


class CandidateDashboardOverviewSerializer(serializers.Serializer):
    stats = CandidateDashboardStatsSerializer()
    upcoming_exams = CandidateAssignedExamSerializer(many=True)
    recent_results = ResultSerializer(many=True)
    recent_materials = MaterialSerializer(many=True)
