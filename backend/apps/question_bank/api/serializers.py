from rest_framework import serializers

from apps.academics.models import Subject
from apps.platform_core.i18n import t
from apps.question_bank.models import (
    Question,
    QuestionAnswerKey,
    QuestionImportBatch,
    QuestionImportError,
    QuestionOption,
    QuestionRevision,
    QuestionTag,
)
from apps.question_bank.services import create_question, revise_question


class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ("key", "text", "sort_order")


class QuestionAnswerKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAnswerKey
        fields = (
            "correct_option_keys",
            "acceptable_answers",
            "essay_rubric",
            "sample_answer",
        )


class QuestionRevisionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, read_only=True)
    answer_key = QuestionAnswerKeySerializer(read_only=True)

    class Meta:
        model = QuestionRevision
        fields = (
            "id",
            "revision_number",
            "question_text",
            "options",
            "answer_key",
            "created_at",
        )


class QuestionTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionTag
        fields = ("id", "name", "slug")


class QuestionSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ("id", "name", "code", "color")


class QuestionReadSerializer(serializers.ModelSerializer):
    subject = QuestionSubjectSerializer(read_only=True)
    tags = QuestionTagSerializer(many=True, read_only=True)
    current_revision = QuestionRevisionSerializer(read_only=True)

    class Meta:
        model = Question
        fields = (
            "id",
            "difficulty",
            "question_type",
            "subject",
            "tags",
            "current_revision",
            "created_at",
            "updated_at",
        )


class QuestionOptionInputSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=8)
    text = serializers.CharField()


class QuestionWriteSerializer(serializers.Serializer):
    subject_id = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(),
        source="subject",
        required=False,
    )
    difficulty = serializers.ChoiceField(choices=Question.Difficulty.choices, required=False)
    question_type = serializers.ChoiceField(choices=Question.Type.choices, required=False)
    question_text = serializers.CharField(required=False)
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    options = QuestionOptionInputSerializer(many=True, required=False)
    correct_option_keys = serializers.ListField(child=serializers.CharField(), required=False)
    acceptable_answers = serializers.ListField(child=serializers.CharField(), required=False)
    essay_rubric = serializers.CharField(required=False, allow_blank=True)
    sample_answer = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        question = self.context.get("question")
        effective = {
            "subject": attrs.get("subject") or getattr(question, "subject", None),
            "difficulty": attrs.get("difficulty") or getattr(question, "difficulty", None),
            "question_type": attrs.get("question_type") or getattr(question, "question_type", None),
            "question_text": attrs.get("question_text")
            or getattr(getattr(question, "current_revision", None), "question_text", None),
            "options": attrs.get("options"),
            "correct_option_keys": attrs.get("correct_option_keys"),
        }

        if question and effective["options"] is None:
            effective["options"] = [
                {"key": option.key, "text": option.text}
                for option in question.current_revision.options.all()
            ]
        effective["options"] = effective["options"] or []

        if question and effective["correct_option_keys"] is None:
            answer_key = getattr(question.current_revision, "answer_key", None)
            effective["correct_option_keys"] = getattr(answer_key, "correct_option_keys", [])
        effective["correct_option_keys"] = effective["correct_option_keys"] or []

        missing = [field for field in ("subject", "difficulty", "question_type", "question_text") if not effective[field]]
        if missing:
            raise serializers.ValidationError(
                {field: t(vi="Truong nay la bat buoc.", en="This field is required.") for field in missing}
            )

        if effective["question_type"] in {
            Question.Type.MULTIPLE_CHOICE,
            Question.Type.TRUE_FALSE,
        }:
            if not effective["options"]:
                raise serializers.ValidationError(
                    {"options": t(vi="Cau hoi trac nghiem bat buoc phai co dap an lua chon.", en="Objective questions require options.")}
                )
            if not effective["correct_option_keys"]:
                raise serializers.ValidationError(
                    {
                        "correct_option_keys": t(
                            vi="Cau hoi trac nghiem bat buoc phai co dap an dung.",
                            en="Objective questions require correct option keys.",
                        )
                    }
                )
            option_keys = {option["key"] for option in effective["options"]}
            invalid_keys = [key for key in effective["correct_option_keys"] if key not in option_keys]
            if invalid_keys:
                raise serializers.ValidationError(
                    {
                        "correct_option_keys": t(
                            vi=f"Khong tim thay key dap an: {', '.join(invalid_keys)}",
                            en=f"Unknown option keys: {', '.join(invalid_keys)}",
                        )
                    }
                )

        return attrs

    def create(self, validated_data):
        return create_question(
            subject=validated_data["subject"],
            created_by=self.context["request"].user,
            difficulty=validated_data["difficulty"],
            question_type=validated_data["question_type"],
            question_text=validated_data["question_text"],
            tags=validated_data.get("tags", []),
            options=validated_data.get("options", []),
            correct_option_keys=validated_data.get("correct_option_keys", []),
            essay_rubric=validated_data.get("essay_rubric", ""),
            sample_answer=validated_data.get("sample_answer", ""),
            acceptable_answers=validated_data.get("acceptable_answers", []),
        )

    def update(self, instance, validated_data):
        return revise_question(
            question=instance,
            updated_by=self.context["request"].user,
            subject=validated_data.get("subject"),
            difficulty=validated_data.get("difficulty"),
            question_type=validated_data.get("question_type"),
            question_text=validated_data.get("question_text"),
            tags=validated_data.get("tags") if "tags" in validated_data else None,
            options=validated_data.get("options") if "options" in validated_data else None,
            correct_option_keys=validated_data.get("correct_option_keys") if "correct_option_keys" in validated_data else None,
            essay_rubric=validated_data.get("essay_rubric") if "essay_rubric" in validated_data else None,
            sample_answer=validated_data.get("sample_answer") if "sample_answer" in validated_data else None,
            acceptable_answers=validated_data.get("acceptable_answers") if "acceptable_answers" in validated_data else None,
        )


class QuestionImportErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionImportError
        fields = ("id", "row_number", "field_name", "message", "raw_payload")


class QuestionImportBatchSerializer(serializers.ModelSerializer):
    errors = QuestionImportErrorSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionImportBatch
        fields = (
            "id",
            "source_format",
            "file_name",
            "status",
            "total_records",
            "success_count",
            "error_count",
            "created_question_ids",
            "errors",
            "created_at",
        )


class QuestionImportBatchCreateSerializer(serializers.Serializer):
    source_format = serializers.ChoiceField(choices=QuestionImportBatch.SourceFormat.choices)
    file = serializers.FileField()
    # Chay thu: tra ve bao cao kiem tra tung dong, khong tao cau hoi nao.
    dry_run = serializers.BooleanField(required=False, default=False)
    # Bo qua cau trung voi ngan hang hoac trung trong cung file.
    skip_duplicates = serializers.BooleanField(required=False, default=False)
