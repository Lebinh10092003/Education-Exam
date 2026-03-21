from rest_framework import serializers

from apps.academics.models import Subject


class SubjectSerializer(serializers.ModelSerializer):
    questions_count = serializers.IntegerField(read_only=True)
    exams_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Subject
        fields = (
            "id",
            "name",
            "code",
            "description",
            "color",
            "is_active",
            "questions_count",
            "exams_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "questions_count",
            "exams_count",
            "created_at",
            "updated_at",
        )
