import re

from django.utils import timezone
from rest_framework import serializers

from ..models import Competition, CompetitionRegistration

PHONE_PATTERN = re.compile(r"^\+?[0-9 .\-]{8,15}$")


class CompetitionSerializer(serializers.ModelSerializer):
    """Quan tri: day du truong + trang thai tinh theo ngay + so luot dang ky."""

    status = serializers.SerializerMethodField()
    accepts_registration = serializers.SerializerMethodField()
    registration_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Competition
        fields = (
            "id",
            "name",
            "code",
            "description",
            "cycle",
            "exam_date",
            "registration_deadline",
            "registration_open",
            "is_featured",
            "is_active",
            "sort_order",
            "info_url",
            "status",
            "accepts_registration",
            "registration_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_status(self, obj):
        return obj.status_on()

    def get_accepts_registration(self, obj):
        return obj.accepts_registration_on()

    def validate(self, attrs):
        exam_date = attrs.get("exam_date", getattr(self.instance, "exam_date", None))
        deadline = attrs.get("registration_deadline", getattr(self.instance, "registration_deadline", None))
        if exam_date and deadline and deadline > exam_date:
            raise serializers.ValidationError({"registration_deadline": "Hạn đăng ký phải trước hoặc bằng ngày thi."})
        return attrs


class PublicCompetitionSerializer(serializers.Serializer):
    """Cong khai: chi cac truong can hien thi."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    code = serializers.CharField()
    description = serializers.CharField()
    cycle = serializers.CharField()
    exam_date = serializers.DateField()
    registration_deadline = serializers.DateField(allow_null=True)
    info_url = serializers.CharField()
    status = serializers.CharField()
    accepts_registration = serializers.BooleanField()


class RegistrationCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    date_of_birth = serializers.DateField()
    grade = serializers.CharField(max_length=32)
    school = serializers.CharField(max_length=255)
    class_name = serializers.CharField(max_length=64, required=False, allow_blank=True)
    cccd = serializers.CharField(max_length=32, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    ward = serializers.CharField(max_length=255, required=False, allow_blank=True)
    city = serializers.CharField(max_length=255, required=False, allow_blank=True)
    email = serializers.EmailField()
    guardian_phone = serializers.CharField(max_length=32)
    competition_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    # O "bay" chong bot: nguoi that khong thay va khong dien.
    website = serializers.CharField(required=False, allow_blank=True)

    def validate_full_name(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Họ tên quá ngắn.")
        return value

    def validate_guardian_phone(self, value):
        value = value.strip()
        if not PHONE_PATTERN.match(value):
            raise serializers.ValidationError("Số điện thoại không hợp lệ.")
        return value

    def validate_cccd(self, value):
        value = (value or "").strip()
        if value and not re.fullmatch(r"\d{9}|\d{12}", value):
            raise serializers.ValidationError("CCCD phải gồm 9 hoặc 12 chữ số.")
        return value

    def validate_date_of_birth(self, value):
        if value >= timezone.localdate():
            raise serializers.ValidationError("Ngày sinh không hợp lệ.")
        return value

    def validate(self, attrs):
        if attrs.get("website"):
            raise serializers.ValidationError("Yêu cầu không hợp lệ.")
        ids = list(dict.fromkeys(attrs["competition_ids"]))
        competitions = list(Competition.objects.filter(id__in=ids, is_active=True))
        if len(competitions) != len(ids):
            raise serializers.ValidationError({"competition_ids": "Có cuộc thi không tồn tại hoặc đã ẩn."})
        attrs["competitions"] = competitions
        return attrs


class RegistrationSerializer(serializers.ModelSerializer):
    competitions = serializers.SerializerMethodField()
    handled_by_name = serializers.CharField(source="handled_by.full_name", read_only=True, default="")

    class Meta:
        model = CompetitionRegistration
        fields = (
            "id",
            "full_name",
            "date_of_birth",
            "grade",
            "school",
            "class_name",
            "cccd",
            "address",
            "ward",
            "city",
            "email",
            "guardian_phone",
            "competitions",
            "status",
            "admin_note",
            "handled_by_name",
            "handled_at",
            "created_at",
        )

    def get_competitions(self, obj):
        return [{"id": c.id, "code": c.code, "name": c.name, "cycle": c.cycle} for c in obj.competitions.all()]


class RegistrationUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=CompetitionRegistration.Status.choices)
    admin_note = serializers.CharField(required=False, allow_blank=True)
