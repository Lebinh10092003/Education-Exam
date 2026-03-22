from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.institutions.models import CandidateGroup, GroupMembership, School


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = (
            "id",
            "name",
            "code",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class GroupMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(),
        source="user",
    )
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = GroupMembership
        fields = (
            "id",
            "user_id",
            "user_email",
            "user_name",
            "is_active",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "user_email", "user_name")


class GroupMembershipImportErrorSerializer(serializers.Serializer):
    row_number = serializers.IntegerField()
    identifier = serializers.CharField(allow_blank=True)
    message = serializers.CharField()


class GroupMembershipImportSummarySerializer(serializers.Serializer):
    total_rows = serializers.IntegerField()
    created_users = serializers.IntegerField()
    updated_users = serializers.IntegerField()
    assigned_users = serializers.IntegerField()
    skipped_rows = serializers.IntegerField()
    failed_rows = serializers.IntegerField()
    errors = GroupMembershipImportErrorSerializer(many=True)


class CandidateGroupSerializer(serializers.ModelSerializer):
    school_id = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        source="school",
        allow_null=True,
        required=False,
    )
    school_name = serializers.CharField(source="school.name", read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    exams_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CandidateGroup
        fields = (
            "id",
            "name",
            "description",
            "school_id",
            "school_name",
            "is_active",
            "member_count",
            "exams_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "school_name",
            "member_count",
            "exams_count",
            "created_at",
            "updated_at",
        )
