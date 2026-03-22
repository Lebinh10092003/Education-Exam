from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ..models import AuditEvent


class LivenessSerializer(serializers.Serializer):
    status = serializers.CharField()


class ReadinessSerializer(serializers.Serializer):
    status = serializers.CharField()
    components = serializers.DictField(child=serializers.CharField())


class DashboardActivityPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    exams = serializers.IntegerField()
    candidates = serializers.IntegerField()


class DashboardRecentExamSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    subject = serializers.CharField()
    status = serializers.CharField()
    candidates = serializers.IntegerField()
    completed = serializers.IntegerField()
    time_left = serializers.CharField()


class DashboardAlertSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.CharField()
    message = serializers.CharField()
    time = serializers.CharField()
    exam_id = serializers.IntegerField(allow_null=True)


class DashboardOverviewSerializer(serializers.Serializer):
    total_candidates = serializers.IntegerField()
    active_exams = serializers.IntegerField()
    question_bank_count = serializers.IntegerField()
    completion_rate = serializers.DecimalField(max_digits=7, decimal_places=2)
    activity = DashboardActivityPointSerializer(many=True)
    recent_exams = DashboardRecentExamSerializer(many=True)
    alerts = DashboardAlertSerializer(many=True)


class AuditActorSerializer(serializers.Serializer):
    id = serializers.IntegerField(allow_null=True)
    email = serializers.CharField(allow_blank=True)
    full_name = serializers.CharField(allow_blank=True)


class AuditEventSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = (
            "id",
            "actor",
            "actor_email",
            "actor_name",
            "action",
            "category",
            "severity",
            "description",
            "metadata",
            "request_id",
            "ip_address",
            "occurred_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    @extend_schema_field(AuditActorSerializer)
    def get_actor(self, obj):
        if obj.actor_id is None:
            return {
                "id": None,
                "email": obj.actor_email,
                "full_name": obj.actor_name,
            }
        return {
            "id": obj.actor_id,
            "email": obj.actor.email,
            "full_name": obj.actor.full_name,
        }


class AuditEventSummarySerializer(serializers.Serializer):
    total_events = serializers.IntegerField()
    warning_events = serializers.IntegerField()
    error_events = serializers.IntegerField()
    today_events = serializers.IntegerField()
