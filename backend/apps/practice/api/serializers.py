from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.exam_delivery.api.serializers import CandidateExamSubjectSerializer

from ..models import PracticeAutosaveSnapshot, PracticeSession, PracticeSessionQuestion
from ..services import get_remaining_seconds


class PracticeCatalogCountsSerializer(serializers.Serializer):
    easy = serializers.IntegerField()
    medium = serializers.IntegerField()
    hard = serializers.IntegerField()
    total = serializers.IntegerField()


class PracticeCatalogItemSerializer(serializers.Serializer):
    subject = CandidateExamSubjectSerializer()
    counts = PracticeCatalogCountsSerializer()


class PracticeSessionQuestionOptionSerializer(serializers.Serializer):
    key = serializers.CharField()
    text = serializers.CharField()
    sort_order = serializers.IntegerField()


class PracticeSessionQuestionSerializer(serializers.ModelSerializer):
    options = PracticeSessionQuestionOptionSerializer(source="options_payload", many=True, read_only=True)

    class Meta:
        model = PracticeSessionQuestion
        fields = (
            "id",
            "sort_order",
            "difficulty",
            "question_type",
            "question_text",
            "options",
            "selected_option_keys",
            "is_answered",
            "is_marked_for_review",
        )


class PracticeSessionSerializer(serializers.ModelSerializer):
    subject = CandidateExamSubjectSerializer(read_only=True)
    remaining_seconds = serializers.SerializerMethodField()
    answered_count = serializers.SerializerMethodField()
    marked_count = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    questions = PracticeSessionQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = PracticeSession
        fields = (
            "id",
            "subject",
            "status",
            "duration_minutes",
            "question_count",
            "started_at",
            "expires_at",
            "submitted_at",
            "remaining_seconds",
            "correct_count",
            "total_count",
            "score_percentage",
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
        return obj.questions.filter(is_answered=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_marked_count(self, obj):
        return obj.questions.filter(is_marked_for_review=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_total_questions(self, obj):
        return obj.questions.count()


class PracticeSessionHistorySerializer(serializers.ModelSerializer):
    subject = CandidateExamSubjectSerializer(read_only=True)
    answered_count = serializers.SerializerMethodField()
    marked_count = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = PracticeSession
        fields = (
            "id",
            "subject",
            "status",
            "duration_minutes",
            "question_count",
            "started_at",
            "expires_at",
            "submitted_at",
            "remaining_seconds",
            "correct_count",
            "total_count",
            "score_percentage",
            "answered_count",
            "marked_count",
            "total_questions",
        )

    @extend_schema_field(OpenApiTypes.INT)
    def get_answered_count(self, obj):
        return obj.questions.filter(is_answered=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_marked_count(self, obj):
        return obj.questions.filter(is_marked_for_review=True).count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_total_questions(self, obj):
        return obj.questions.count()

    @extend_schema_field(OpenApiTypes.INT)
    def get_remaining_seconds(self, obj):
        return get_remaining_seconds(obj)


class PracticeSessionCreateSerializer(serializers.Serializer):
    subject_id = serializers.IntegerField()
    duration_minutes = serializers.IntegerField(min_value=5, max_value=180)
    difficulty_counts = serializers.DictField(child=serializers.IntegerField(min_value=0))

    def validate(self, attrs):
        total = sum(int(attrs["difficulty_counts"].get(key, 0)) for key in ("easy", "medium", "hard"))
        if total <= 0:
            raise serializers.ValidationError("At least one practice question is required.")
        return attrs


class PracticeSessionAnswerWriteSerializer(serializers.Serializer):
    selected_option_keys = serializers.ListField(child=serializers.CharField(), required=False)
    is_marked_for_review = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("At least one field must be provided.")
        return attrs


class PracticeSessionAnswerResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeSessionQuestion
        fields = (
            "id",
            "selected_option_keys",
            "is_answered",
            "is_marked_for_review",
            "updated_at",
        )


class PracticeAutosaveSnapshotWriteSerializer(serializers.Serializer):
    payload = serializers.JSONField(required=False)


class PracticeAutosaveSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeAutosaveSnapshot
        fields = ("id", "answered_count", "marked_count", "payload", "created_at")


class PracticeSessionSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeSession
        fields = (
            "id",
            "status",
            "submitted_at",
            "correct_count",
            "total_count",
            "score_percentage",
        )


class PracticeReviewQuestionSerializer(serializers.ModelSerializer):
    options = PracticeSessionQuestionOptionSerializer(source="options_payload", many=True, read_only=True)

    class Meta:
        model = PracticeSessionQuestion
        fields = (
            "id",
            "sort_order",
            "difficulty",
            "question_type",
            "question_text",
            "options",
            "selected_option_keys",
            "correct_option_keys",
            "is_answered",
            "is_marked_for_review",
            "is_correct",
            "explanation_text",
        )


class PracticeReviewSummarySerializer(serializers.Serializer):
    correct_count = serializers.IntegerField()
    incorrect_count = serializers.IntegerField()
    total_count = serializers.IntegerField()
    score_percentage = serializers.DecimalField(max_digits=6, decimal_places=2)


class PracticeReviewSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    subject = CandidateExamSubjectSerializer()
    status = serializers.CharField()
    started_at = serializers.DateTimeField()
    submitted_at = serializers.DateTimeField(allow_null=True)
    duration_minutes = serializers.IntegerField()
    summary = PracticeReviewSummarySerializer()
    questions = PracticeReviewQuestionSerializer(many=True)

