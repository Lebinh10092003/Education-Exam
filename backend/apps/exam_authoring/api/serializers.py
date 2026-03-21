from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.academics.models import Subject
from apps.question_bank.models import Question, QuestionTag

from ..models import Exam, ExamItem, ExamRandomRule, ExamScheduleWindow, ExamVersion
from ..services import UNSET, build_exam_assignment_summary, create_exam, revise_exam


class ExamSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ("id", "name", "code", "color")


class ExamScheduleWindowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamScheduleWindow
        fields = ("opens_at", "closes_at")


class ExamQuestionRevisionSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(source="question_revision.id")
    question_id = serializers.IntegerField(source="question_revision.question_id")
    revision_number = serializers.IntegerField(source="question_revision.revision_number")
    question_text = serializers.CharField(source="question_revision.question_text")
    question_type = serializers.CharField(source="question_revision.question.question_type")
    difficulty = serializers.CharField(source="question_revision.question.difficulty")


class ExamItemSerializer(serializers.ModelSerializer):
    question = ExamQuestionRevisionSummarySerializer(source="*", read_only=True)

    class Meta:
        model = ExamItem
        fields = ("id", "source", "sort_order", "points", "question")


class ExamRandomRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamRandomRule
        fields = ("id", "sort_order", "difficulty", "question_type", "tag_ids", "count")


class ExamVersionSerializer(serializers.ModelSerializer):
    items = ExamItemSerializer(many=True, read_only=True)
    random_rules = ExamRandomRuleSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = ExamVersion
        fields = ("id", "version_number", "item_count", "items", "random_rules", "created_at")

    @extend_schema_field(OpenApiTypes.INT)
    def get_item_count(self, obj):
        return obj.items.count()


class ExamAssignedGroupSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    member_count = serializers.IntegerField()


class ExamAssignmentSummarySerializer(serializers.Serializer):
    group_count = serializers.IntegerField()
    user_count = serializers.IntegerField()
    total_candidates = serializers.IntegerField()
    assigned_group_ids = serializers.ListField(child=serializers.IntegerField())
    assigned_user_ids = serializers.ListField(child=serializers.IntegerField())
    assigned_groups = ExamAssignedGroupSerializer(many=True)


class ExamDeliverySummarySerializer(serializers.Serializer):
    total_sessions = serializers.IntegerField()
    in_progress_sessions = serializers.IntegerField()
    submitted_sessions = serializers.IntegerField()


class ExamReadSerializer(serializers.ModelSerializer):
    subject = ExamSubjectSerializer(read_only=True)
    current_version = ExamVersionSerializer(read_only=True)
    schedule_window = ExamScheduleWindowSerializer(read_only=True)
    assignment_summary = serializers.SerializerMethodField()
    delivery_summary = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = (
            "id",
            "name",
            "subject",
            "description",
            "status",
            "duration_minutes",
            "passing_score",
            "max_attempts",
            "shuffle_questions",
            "show_results_immediately",
            "enable_proctoring",
            "current_version",
            "schedule_window",
            "assignment_summary",
            "delivery_summary",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(ExamAssignmentSummarySerializer)
    def get_assignment_summary(self, obj):
        return build_exam_assignment_summary(obj)

    @extend_schema_field(ExamDeliverySummarySerializer)
    def get_delivery_summary(self, obj):
        return {
            "total_sessions": getattr(obj, "total_sessions", obj.sessions.count()),
            "in_progress_sessions": getattr(obj, "in_progress_sessions", obj.sessions.filter(status="in_progress").count()),
            "submitted_sessions": getattr(obj, "submitted_sessions", obj.sessions.filter(status="submitted").count()),
        }


class ExamRandomRuleInputSerializer(serializers.Serializer):
    difficulty = serializers.ChoiceField(choices=Question.Difficulty.choices, required=False, allow_blank=True)
    question_type = serializers.ChoiceField(choices=Question.Type.choices, required=False, allow_blank=True)
    tag_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    count = serializers.IntegerField(min_value=1)


class ExamWriteSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    subject_id = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(), source="subject", required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Exam.Status.choices, required=False)
    duration_minutes = serializers.IntegerField(required=False, min_value=1)
    passing_score = serializers.IntegerField(required=False, min_value=0, max_value=100)
    max_attempts = serializers.IntegerField(required=False, min_value=1)
    shuffle_questions = serializers.BooleanField(required=False)
    show_results_immediately = serializers.BooleanField(required=False)
    enable_proctoring = serializers.BooleanField(required=False)
    opening_at = serializers.DateTimeField(required=False, allow_null=True)
    closing_at = serializers.DateTimeField(required=False, allow_null=True)
    manual_question_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    random_rules = ExamRandomRuleInputSerializer(many=True, required=False)
    group_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    user_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def validate(self, attrs):
        exam = self.instance
        effective = {
            "name": attrs.get("name", getattr(exam, "name", None)),
            "subject": attrs.get("subject", getattr(exam, "subject", None)),
            "duration_minutes": attrs.get("duration_minutes", getattr(exam, "duration_minutes", None)),
            "passing_score": attrs.get("passing_score", getattr(exam, "passing_score", None)),
            "max_attempts": attrs.get("max_attempts", getattr(exam, "max_attempts", None)),
            "opening_at": attrs.get(
                "opening_at",
                getattr(getattr(exam, "schedule_window", None), "opens_at", None),
            ),
            "closing_at": attrs.get(
                "closing_at",
                getattr(getattr(exam, "schedule_window", None), "closes_at", None),
            ),
        }

        if exam is None:
            missing = [
                field
                for field in ("name", "subject", "duration_minutes", "passing_score", "max_attempts")
                if effective[field] in (None, "")
            ]
            if missing:
                raise serializers.ValidationError({field: "This field is required." for field in missing})

        if effective["opening_at"] and effective["closing_at"] and effective["closing_at"] <= effective["opening_at"]:
            raise serializers.ValidationError({"closing_at": "Closing time must be after opening time."})

        if (
            exam is not None
            and "subject" in attrs
            and attrs["subject"] != exam.subject
            and exam.current_version_id
            and "manual_question_ids" not in attrs
            and "random_rules" not in attrs
            and exam.current_version.items.exists()
        ):
            raise serializers.ValidationError(
                {"subject_id": "Changing subject requires a new question composition for the next exam version."}
            )

        tag_ids = {
            tag_id
            for rule in attrs.get("random_rules", [])
            for tag_id in rule.get("tag_ids", [])
        }
        if tag_ids:
            found_tag_ids = set(QuestionTag.objects.filter(id__in=tag_ids).values_list("id", flat=True))
            missing_tag_ids = sorted(tag_ids - found_tag_ids)
            if missing_tag_ids:
                raise serializers.ValidationError(
                    {"random_rules": f"Unknown tag ids: {', '.join(map(str, missing_tag_ids))}"}
                )

        return attrs

    def create(self, validated_data):
        return create_exam(
            name=validated_data["name"],
            subject=validated_data["subject"],
            created_by=self.context["request"].user,
            description=validated_data.get("description", ""),
            status=validated_data.get("status", Exam.Status.DRAFT),
            duration_minutes=validated_data["duration_minutes"],
            passing_score=validated_data["passing_score"],
            max_attempts=validated_data["max_attempts"],
            shuffle_questions=validated_data.get("shuffle_questions", False),
            show_results_immediately=validated_data.get("show_results_immediately", False),
            enable_proctoring=validated_data.get("enable_proctoring", False),
            opening_at=validated_data.get("opening_at"),
            closing_at=validated_data.get("closing_at"),
            manual_question_ids=validated_data.get("manual_question_ids", []),
            random_rules=validated_data.get("random_rules", []),
            group_ids=validated_data.get("group_ids", []),
            user_ids=validated_data.get("user_ids", []),
        )

    def update(self, instance, validated_data):
        return revise_exam(
            exam=instance,
            updated_by=self.context["request"].user,
            name=validated_data["name"] if "name" in validated_data else UNSET,
            subject=validated_data["subject"] if "subject" in validated_data else UNSET,
            description=validated_data["description"] if "description" in validated_data else UNSET,
            status=validated_data["status"] if "status" in validated_data else UNSET,
            duration_minutes=validated_data["duration_minutes"] if "duration_minutes" in validated_data else UNSET,
            passing_score=validated_data["passing_score"] if "passing_score" in validated_data else UNSET,
            max_attempts=validated_data["max_attempts"] if "max_attempts" in validated_data else UNSET,
            shuffle_questions=validated_data["shuffle_questions"] if "shuffle_questions" in validated_data else UNSET,
            show_results_immediately=validated_data["show_results_immediately"]
            if "show_results_immediately" in validated_data
            else UNSET,
            enable_proctoring=validated_data["enable_proctoring"] if "enable_proctoring" in validated_data else UNSET,
            opening_at=validated_data["opening_at"] if "opening_at" in validated_data else UNSET,
            closing_at=validated_data["closing_at"] if "closing_at" in validated_data else UNSET,
            manual_question_ids=validated_data["manual_question_ids"] if "manual_question_ids" in validated_data else UNSET,
            random_rules=validated_data["random_rules"] if "random_rules" in validated_data else UNSET,
            group_ids=validated_data["group_ids"] if "group_ids" in validated_data else UNSET,
            user_ids=validated_data["user_ids"] if "user_ids" in validated_data else UNSET,
        )


class ExamGroupAssignmentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    member_count = serializers.IntegerField()
    assigned = serializers.BooleanField()
    school = serializers.DictField()


class ExamGroupAssignmentSyncSerializer(serializers.Serializer):
    group_ids = serializers.ListField(child=serializers.IntegerField(), required=True)


class ExamStudentImportRequestSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)


class ExamStudentImportErrorSerializer(serializers.Serializer):
    row_number = serializers.IntegerField()
    identifier = serializers.CharField()
    message = serializers.CharField()


class ExamStudentImportSummarySerializer(serializers.Serializer):
    total_rows = serializers.IntegerField()
    created_users = serializers.IntegerField()
    updated_users = serializers.IntegerField()
    assigned_users = serializers.IntegerField()
    skipped_rows = serializers.IntegerField()
    failed_rows = serializers.IntegerField()
    errors = ExamStudentImportErrorSerializer(many=True)
