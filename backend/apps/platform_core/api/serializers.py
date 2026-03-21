from rest_framework import serializers


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
