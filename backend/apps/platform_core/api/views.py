import calendar
from datetime import date
from datetime import datetime
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.exam_authoring.lifecycle import resolve_exam_phase
from apps.exam_authoring.models import Exam
from apps.platform_core.i18n import t
from apps.exam_authoring.services import build_exam_assignment_summary
from apps.exam_delivery.models import ExamSession
from apps.identity.models import User
from apps.identity.permissions import HasAPIPermissionCode
from apps.platform_core.models import AuditEvent
from apps.proctoring.models import ProctorEvent
from apps.question_bank.models import Question

from .serializers import (
    AuditEventSerializer,
    AuditEventSummarySerializer,
    DashboardOverviewSerializer,
    LivenessSerializer,
    ReadinessSerializer,
)


class LivenessView(generics.GenericAPIView):
    authentication_classes = []
    permission_classes = []
    serializer_class = LivenessSerializer

    def get(self, request):
        serializer = self.get_serializer({"status": "ok"})
        return Response(serializer.data)


class ReadinessView(generics.GenericAPIView):
    authentication_classes = []
    permission_classes = []
    serializer_class = ReadinessSerializer

    def get(self, request):
        components = {
            "database": "configured" if settings.DATABASES.get("default") else "missing",
            "redis": "configured" if getattr(settings, "REDIS_URL", None) else "missing",
            "storage": "object-storage"
            if getattr(settings, "USE_S3_STORAGE", False)
            else "filesystem",
        }
        serializer = self.get_serializer({"status": "ok", "components": components})
        return Response(serializer.data)


class AuditEventFilterMixin:
    def get_base_queryset(self):
        return AuditEvent.objects.select_related("actor").order_by("-occurred_at", "-id")

    def filter_audit_queryset(self, queryset):
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(action__icontains=search)
                | Q(category__icontains=search)
                | Q(description__icontains=search)
                | Q(actor_email__icontains=search)
                | Q(actor_name__icontains=search)
                | Q(request_id__icontains=search)
            )

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        severity = self.request.query_params.get("severity")
        if severity:
            queryset = queryset.filter(severity=severity)

        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            try:
                queryset = queryset.filter(occurred_at__date__gte=date.fromisoformat(date_from))
            except ValueError:
                pass

        date_to = self.request.query_params.get("date_to")
        if date_to:
            try:
                queryset = queryset.filter(occurred_at__date__lte=date.fromisoformat(date_to))
            except ValueError:
                pass

        return queryset


class AuditEventListView(AuditEventFilterMixin, generics.ListAPIView):
    serializer_class = AuditEventSerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "audit.view"

    def get_queryset(self):
        return self.filter_audit_queryset(self.get_base_queryset())


class AuditEventSummaryView(AuditEventFilterMixin, generics.GenericAPIView):
    serializer_class = AuditEventSummarySerializer
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "audit.view"

    def get(self, request):
        queryset = self.filter_audit_queryset(self.get_base_queryset())
        payload = {
            "total_events": queryset.count(),
            "warning_events": queryset.filter(severity=AuditEvent.Severity.WARNING).count(),
            "error_events": queryset.filter(severity=AuditEvent.Severity.ERROR).count(),
            "today_events": queryset.filter(occurred_at__date=timezone.localdate()).count(),
        }
        serializer = self.get_serializer(payload)
        return Response(serializer.data)


def _month_starts(count=6):
    current = timezone.localtime().date().replace(day=1)
    months = []
    year = current.year
    month = current.month
    for _ in range(count):
        months.append(datetime(year, month, 1, tzinfo=timezone.get_current_timezone()))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(months))


def _format_exam_time_left(exam):
    now = timezone.now()
    schedule_window = getattr(exam, "schedule_window", None)
    if schedule_window is None:
        return "-"

    if schedule_window.opens_at and exam.status == Exam.Status.SCHEDULED and schedule_window.opens_at > now:
        delta = schedule_window.opens_at - now
        days = int(delta.total_seconds() // 86400)
        hours = int((delta.total_seconds() % 86400) // 3600)
        if days > 0:
            return t(vi=f"Mở sau {days} ngày", en=f"Starts in {days}d")
        if hours > 0:
            return t(vi=f"Mở sau {hours} giờ", en=f"Starts in {hours}h")
        return t(vi="Sắp mở", en="Starts soon")

    if schedule_window.closes_at and schedule_window.closes_at > now:
        delta = schedule_window.closes_at - now
        hours = int(delta.total_seconds() // 3600)
        minutes = int((delta.total_seconds() % 3600) // 60)
        if hours >= 48:
            return t(vi=f"Còn {hours // 24} ngày", en=f"{hours // 24}d left")
        return t(vi=f"Còn {hours} giờ {minutes} phút", en=f"{hours}h {minutes}m left")

    if schedule_window.closes_at and schedule_window.closes_at <= now:
        return t(vi="Đã kết thúc", en="Ended")

    return "-"


class DashboardOverviewView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, HasAPIPermissionCode]
    permission_code = "exams.view"
    serializer_class = DashboardOverviewSerializer

    def get(self, request):
        now = timezone.now()
        effective_open_exam_filter = (
            Q(status=Exam.Status.OPEN)
            | Q(status=Exam.Status.SCHEDULED, schedule_window__opens_at__lte=now)
        ) & (Q(schedule_window__closes_at__isnull=True) | Q(schedule_window__closes_at__gt=now))
        effective_open_alert_exam_filter = (
            Q(session__exam__status=Exam.Status.OPEN)
            | Q(session__exam__status=Exam.Status.SCHEDULED, session__exam__schedule_window__opens_at__lte=now)
        ) & (
            Q(session__exam__schedule_window__closes_at__isnull=True)
            | Q(session__exam__schedule_window__closes_at__gt=now)
        )
        candidate_role_filter = Q(user_roles__role__slug="candidate")
        total_candidates = User.objects.filter(candidate_role_filter, user_roles__is_active=True).distinct().count()
        active_exams = Exam.objects.filter(effective_open_exam_filter).count()
        question_bank_count = Question.objects.count()
        total_sessions = ExamSession.objects.count()
        submitted_sessions = ExamSession.objects.filter(status=ExamSession.Status.SUBMITTED).count()
        completion_rate = Decimal("0.00")
        if total_sessions:
            completion_rate = (Decimal(submitted_sessions) / Decimal(total_sessions)) * Decimal("100")

        activity = []
        month_starts = _month_starts()
        for index, start in enumerate(month_starts):
            if index + 1 < len(month_starts):
                end = month_starts[index + 1]
            else:
                next_month = start.month + 1
                next_year = start.year
                if next_month == 13:
                    next_month = 1
                    next_year += 1
                end = datetime(next_year, next_month, 1, tzinfo=start.tzinfo)
            activity.append(
                {
                    "month": calendar.month_abbr[start.month],
                    "exams": Exam.objects.filter(created_at__gte=start, created_at__lt=end).count(),
                    "candidates": ExamSession.objects.filter(
                        started_at__gte=start,
                        started_at__lt=end,
                    ).values("candidate_id").distinct().count(),
                }
            )

        recent_exam_records = (
            Exam.objects.select_related("subject", "schedule_window", "current_version")
            .annotate(completed_count=Count("sessions", filter=Q(sessions__status=ExamSession.Status.SUBMITTED)))
            .order_by("-created_at")[:6]
        )
        recent_exams = []
        for exam in recent_exam_records:
            assignment_summary = build_exam_assignment_summary(exam)
            recent_exams.append(
                {
                    "id": exam.id,
                    "name": exam.name,
                    "subject": exam.subject.name,
                    # Trang thai thuc te theo lich (de "dang mo" nhung qua gio dong -> "closed").
                    "status": "closed" if resolve_exam_phase(exam) == "results" else resolve_exam_phase(exam),
                    "candidates": assignment_summary["total_candidates"],
                    "completed": getattr(exam, "completed_count", 0),
                    "time_left": _format_exam_time_left(exam),
                }
            )

        recent_alerts = (
            ProctorEvent.objects.select_related("session__exam")
            .filter(
                severity__in=[ProctorEvent.Severity.WARNING, ProctorEvent.Severity.CRITICAL],
            )
            .filter(effective_open_alert_exam_filter, session__exam__enable_proctoring=True)
            .order_by("-occurred_at")[:6]
        )
        alerts = [
            {
                "id": alert.id,
                "type": "warning" if alert.severity == ProctorEvent.Severity.WARNING else "critical",
                "message": alert.metadata.get("message") or alert.get_event_type_display(),
                "time": timezone.localtime(alert.occurred_at).strftime("%Y-%m-%d %H:%M"),
                "exam_id": alert.session.exam_id,
            }
            for alert in recent_alerts
        ]

        payload = {
            "total_candidates": total_candidates,
            "active_exams": active_exams,
            "question_bank_count": question_bank_count,
            "completion_rate": completion_rate.quantize(Decimal("0.01")),
            "activity": activity,
            "recent_exams": recent_exams,
            "alerts": alerts,
        }
        serializer = self.get_serializer(payload)
        return Response(serializer.data)
