from django.db.models import Case, F, IntegerField, Q, When
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.platform_core.i18n import t

from .models import Exam


def _now(now=None):
    return now or timezone.now()


def _has_published_results(exam):
    return exam.sessions.filter(result__publish_state="published").exists()


def resolve_exam_phase(exam, now=None):
    current_time = _now(now)
    schedule_window = getattr(exam, "schedule_window", None)
    opens_at = getattr(schedule_window, "opens_at", None)
    closes_at = getattr(schedule_window, "closes_at", None)

    if exam.status == Exam.Status.DRAFT:
        return "draft"

    if exam.status == Exam.Status.ARCHIVED:
        return "closed"

    if exam.status == Exam.Status.CLOSED:
        return "results" if _has_published_results(exam) else "closed"

    if closes_at and closes_at <= current_time:
        return "results" if _has_published_results(exam) else "closed"

    if exam.status == Exam.Status.PAUSED:
        return "paused"

    if exam.status == Exam.Status.OPEN:
        return "open"

    if exam.status == Exam.Status.SCHEDULED:
        if opens_at and opens_at <= current_time:
            return "open"
        return "scheduled"

    return exam.status


def exam_supports_proctoring_runtime(exam, now=None):
    return resolve_exam_phase(exam, now=now) == "open"


def exam_supports_live_monitoring(exam, now=None):
    return resolve_exam_phase(exam, now=now) == "open"


def exam_is_results_visible(exam, now=None):
    return resolve_exam_phase(exam, now=now) == "results"


def assert_exam_phase_allows_start(exam, now=None):
    phase = resolve_exam_phase(exam, now=now)
    if phase == "open":
        return _now(now)
    if phase == "scheduled":
        raise ValidationError(t(vi="Bài thi này chưa mở.", en="This exam is not open yet."))
    if phase == "paused":
        raise ValidationError(t(vi="Bài thi này đang tạm dừng.", en="This exam is currently paused."))
    raise ValidationError(t(vi="Bài thi này đã kết thúc.", en="This exam has already ended."))


def assert_session_allows_interaction(session, now=None, *, allow_submit=False, allow_closed=False):
    phase = resolve_exam_phase(session.exam, now=now)
    if phase == "open":
        return _now(now)
    if phase == "paused":
        raise ValidationError(t(vi="Bài thi này đang tạm dừng.", en="This exam is currently paused."))
    if allow_closed and phase in {"closed", "results"}:
        return _now(now)
    if allow_submit and phase == "open":
        return _now(now)
    raise ValidationError(t(vi="Bài thi này đã kết thúc.", en="This exam has already ended."))


# Thu tu hien thi theo trang thai thuc te (giong resolve_exam_phase, gop "results" vao "closed").
PHASE_RANKS = {"open": 0, "paused": 1, "scheduled": 2, "draft": 3, "closed": 4}


def annotate_exam_phase(queryset, now=None):
    """Them phase_rank (trang thai thuc te theo lich) + moc thoi gian de sap xep/loc o CSDL."""
    current_time = _now(now)
    ended = Q(schedule_window__closes_at__isnull=False, schedule_window__closes_at__lte=current_time)
    started = Q(schedule_window__opens_at__isnull=True) | Q(schedule_window__opens_at__lte=current_time)
    phase_rank = Case(
        When(status=Exam.Status.DRAFT, then=PHASE_RANKS["draft"]),
        When(status__in=[Exam.Status.ARCHIVED, Exam.Status.CLOSED], then=PHASE_RANKS["closed"]),
        When(ended, then=PHASE_RANKS["closed"]),
        When(status=Exam.Status.PAUSED, then=PHASE_RANKS["paused"]),
        When(status=Exam.Status.OPEN, then=PHASE_RANKS["open"]),
        When(Q(status=Exam.Status.SCHEDULED) & started, then=PHASE_RANKS["open"]),
        default=PHASE_RANKS["scheduled"],
        output_field=IntegerField(),
    )
    return queryset.annotate(phase_rank=phase_rank)


def order_exams_by_schedule(queryset):
    """Dang mo (sap dong truoc) -> tam dung -> sap dien ra (sap mo truoc) -> nhap -> da ket thuc (moi nhat truoc)."""
    return queryset.annotate(
        upcoming_time=Case(
            When(phase_rank=PHASE_RANKS["open"], then=F("schedule_window__closes_at")),
            When(phase_rank__in=[PHASE_RANKS["paused"], PHASE_RANKS["scheduled"]], then=F("schedule_window__opens_at")),
            default=None,
        ),
        past_time=Case(
            When(phase_rank=PHASE_RANKS["closed"], then=F("schedule_window__closes_at")),
            default=None,
        ),
    ).order_by(
        "phase_rank",
        F("upcoming_time").asc(nulls_last=True),
        F("past_time").desc(nulls_last=True),
        "-updated_at",
        "-id",
    )
