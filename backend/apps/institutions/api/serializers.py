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
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    date_of_birth = serializers.SerializerMethodField()
    school = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    student_class = serializers.SerializerMethodField()
    ward = serializers.SerializerMethodField()
    national_exam_subject = serializers.SerializerMethodField()
    exam_block = serializers.SerializerMethodField()
    candidate_number = serializers.SerializerMethodField()
    visible_password = serializers.SerializerMethodField()

    class Meta:
        model = GroupMembership
        fields = (
            "id",
            "user_id",
            "user_email",
            "user_name",
            "username",
            "full_name",
            "email",
            "date_of_birth",
            "school",
            "phone_number",
            "student_class",
            "ward",
            "national_exam_subject",
            "exam_block",
            "candidate_number",
            "visible_password",
            "is_active",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "user_email", "user_name")

    def _get_profile(self, obj):
        return getattr(obj.user, "profile", None)

    def get_date_of_birth(self, obj):
        profile = self._get_profile(obj)
        date_of_birth = getattr(profile, "date_of_birth", None)
        return date_of_birth.isoformat() if date_of_birth else None

    def get_school(self, obj):
        profile = self._get_profile(obj)
        school = getattr(profile, "school", None)
        if not school:
            return None
        return {"id": school.id, "name": school.name, "code": school.code}

    def get_phone_number(self, obj):
        profile = self._get_profile(obj)
        return getattr(profile, "phone_number", "") or ""

    def get_student_class(self, obj):
        profile = self._get_profile(obj)
        return getattr(profile, "student_class", "") or ""

    def get_ward(self, obj):
        profile = self._get_profile(obj)
        return getattr(profile, "ward", "") or ""

    def get_national_exam_subject(self, obj):
        profile = self._get_profile(obj)
        return getattr(profile, "national_exam_subject", "") or ""

    def get_exam_block(self, obj):
        profile = self._get_profile(obj)
        return getattr(profile, "exam_block", "") or ""

    def get_candidate_number(self, obj):
        profile = self._get_profile(obj)
        return getattr(profile, "candidate_number", "") or ""

    def get_visible_password(self, obj):
        profile = self._get_profile(obj)
        return getattr(profile, "visible_password", "") or ""


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
    member_count = serializers.IntegerField(read_only=True)
    exams_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CandidateGroup
        fields = (
            "id",
            "name",
            "description",
            "is_active",
            "member_count",
            "exams_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "member_count",
            "exams_count",
            "created_at",
            "updated_at",
        )
