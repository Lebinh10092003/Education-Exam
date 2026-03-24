from django.db.models import Q

from apps.academics.models import Subject
from apps.exam_authoring.models import Exam


def get_assigned_exam_queryset(*, user):
    return Exam.objects.filter(
        Q(assignments__user=user)
        | Q(
            assignments__group__memberships__user=user,
            assignments__group__memberships__is_active=True,
        )
    ).distinct()


def get_candidate_exam_queryset(*, user):
    return (
        get_assigned_exam_queryset(user=user)
        .filter(mode=Exam.Mode.EXAM)
        .exclude(status__in=[Exam.Status.DRAFT, Exam.Status.ARCHIVED])
        .distinct()
    )


def get_learning_access_exam_queryset(*, user):
    return get_assigned_exam_queryset(user=user).exclude(status=Exam.Status.ARCHIVED).distinct()


def get_accessible_subject_queryset(*, user, active_only=True):
    queryset = Subject.objects.filter(exams__in=get_learning_access_exam_queryset(user=user)).distinct()
    if active_only:
        queryset = queryset.filter(is_active=True)
    return queryset.order_by("name", "id")
