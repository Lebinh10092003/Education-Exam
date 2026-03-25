from django.db.models import Count, F, Max, Q
from django.utils import timezone

from apps.exam_authoring.models import Exam

from ..models import ProctorEvent
from ..models import ViolationCase


def build_violation_case_queryset(request):
    queryset = (
        ViolationCase.objects.select_related(
            "session",
            "session__candidate",
            "session__exam",
            "session__exam__subject",
        )
        .prefetch_related("events", "evidences", "reviews", "reviews__reviewer")
        .order_by("status", "-created_at")
    )

    status_filter = request.query_params.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    severity_filter = request.query_params.get("severity")
    if severity_filter:
        queryset = queryset.filter(severity=severity_filter)

    exam_id = request.query_params.get("exam")
    if exam_id:
        queryset = queryset.filter(session__exam_id=exam_id)

    search = request.query_params.get("search")
    if search:
        queryset = queryset.filter(
            Q(session__candidate__email__icontains=search)
            | Q(session__candidate__full_name__icontains=search)
            | Q(session__exam__name__icontains=search)
            | Q(title__icontains=search)
            | Q(summary__icontains=search)
        )

    return queryset


def build_exam_monitoring_hub_queryset(request):
    current_time = timezone.now()
    alert_filter = Q(
        sessions__proctor_events__severity__in=[
            ProctorEvent.Severity.WARNING,
            ProctorEvent.Severity.CRITICAL,
        ]
    )
    effective_open_filter = (
        Q(status=Exam.Status.OPEN)
        | Q(
            status=Exam.Status.SCHEDULED,
            schedule_window__opens_at__lte=current_time,
        )
    ) & (Q(schedule_window__closes_at__isnull=True) | Q(schedule_window__closes_at__gt=current_time))
    queryset = (
        Exam.objects.select_related("subject")
        .filter(enable_proctoring=True)
        .annotate(
            active_group_candidates=Count(
                "assignments__group__memberships",
                filter=Q(assignments__group__memberships__is_active=True),
                distinct=True,
            ),
            direct_assigned_candidates=Count(
                "assignments__user",
                distinct=True,
            ),
            total_sessions=Count("sessions", distinct=True),
            in_progress_sessions=Count(
                "sessions",
                filter=Q(sessions__status="in_progress"),
                distinct=True,
            ),
            submitted_sessions=Count(
                "sessions",
                filter=Q(sessions__status="submitted"),
                distinct=True,
            ),
            alert_count=Count(
                "sessions__proctor_events",
                filter=alert_filter,
                distinct=True,
            ),
            critical_alert_count=Count(
                "sessions__proctor_events",
                filter=Q(sessions__proctor_events__severity=ProctorEvent.Severity.CRITICAL),
                distinct=True,
            ),
            latest_alert_at=Max(
                "sessions__proctor_events__occurred_at",
                filter=alert_filter,
            ),
        )
        .annotate(
            total_candidates=F("active_group_candidates") + F("direct_assigned_candidates"),
        )
        .order_by("-critical_alert_count", "-in_progress_sessions", "-latest_alert_at", "-updated_at")
        .distinct()
    )

    search = request.query_params.get("search")
    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(subject__name__icontains=search))

    status_filter = request.query_params.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    else:
        queryset = queryset.filter(effective_open_filter)

    subject_id = request.query_params.get("subject")
    if subject_id:
        queryset = queryset.filter(subject_id=subject_id)

    severity_filter = request.query_params.get("severity")
    if severity_filter == "critical":
        queryset = queryset.filter(critical_alert_count__gt=0)
    elif severity_filter == "warning":
        queryset = queryset.filter(alert_count__gt=0, critical_alert_count=0)
    elif severity_filter == "has_alerts":
        queryset = queryset.filter(alert_count__gt=0)
    elif severity_filter == "quiet":
        queryset = queryset.filter(alert_count=0)

    return queryset


def build_exam_monitoring_hub_summary(queryset):
    rows = list(
        queryset.order_by().values(
            "id",
            "total_candidates",
            "in_progress_sessions",
            "alert_count",
            "critical_alert_count",
        )
    )
    return {
        "exam_count": len(rows),
        "total_candidates": sum(row["total_candidates"] for row in rows),
        "in_progress_sessions": sum(row["in_progress_sessions"] for row in rows),
        "alert_count": sum(row["alert_count"] for row in rows),
        "critical_exam_count": sum(1 for row in rows if row["critical_alert_count"] > 0),
    }
