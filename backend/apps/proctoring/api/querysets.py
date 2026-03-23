from django.db.models import Q

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
