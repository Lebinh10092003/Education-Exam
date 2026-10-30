from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.notifications.models import Notification
from apps.notifications.services import create_notifications_for_permission

from .models import Competition, CompetitionRegistration

STATUS_ORDER = {
    Competition.Status.ONGOING: 0,
    Competition.Status.UPCOMING: 1,
    Competition.Status.ENDED: 2,
}


def public_competitions(*, featured_only=True, ended_limit=6, today=None):
    """
    Danh sach cuoc thi cho trang chu: dang dien ra -> sap dien ra (gan nhat truoc) -> da ket thuc
    (moi nhat truoc, gioi han ended_limit de lam "lich su thi" ma khong keo dai vo han).
    """
    today = today or timezone.localdate()
    queryset = Competition.objects.filter(is_active=True)
    if featured_only:
        queryset = queryset.filter(is_featured=True)
    items = [(competition, competition.status_on(today)) for competition in queryset]
    items.sort(
        key=lambda pair: (
            STATUS_ORDER[pair[1]],
            -pair[0].exam_date.toordinal() if pair[1] == Competition.Status.ENDED else pair[0].exam_date.toordinal(),
            pair[0].sort_order,
            pair[0].id,
        )
    )
    ended = [pair for pair in items if pair[1] == Competition.Status.ENDED][: max(int(ended_limit), 0)]
    current = [pair for pair in items if pair[1] != Competition.Status.ENDED]
    return current + ended


@transaction.atomic
def create_registration(*, data, competitions, source_ip=None, today=None):
    today = today or timezone.localdate()
    closed = [competition.code for competition in competitions if not competition.accepts_registration_on(today)]
    if closed:
        raise ValidationError({"competition_ids": f"Đã hết hạn đăng ký: {', '.join(closed)}."})
    if data["date_of_birth"] >= today:
        raise ValidationError({"date_of_birth": "Ngày sinh không hợp lệ."})

    registration = CompetitionRegistration.objects.create(source_ip=source_ip, **data)
    registration.competitions.set(competitions)
    codes = ", ".join(competition.code for competition in competitions)
    create_notifications_for_permission(
        permission_code="exams.manage",
        title="Có đăng ký dự thi mới",
        message=f"{registration.full_name} ({registration.school}) đăng ký {codes}.",
        category=Notification.Category.SYSTEM,
        priority=Notification.Priority.MEDIUM,
        action_url="/competitions?tab=registrations",
        metadata={"registration_id": registration.id},
    )
    return registration


def update_registration_status(*, registration, status, admin_note=None, user):
    registration.status = status
    if admin_note is not None:
        registration.admin_note = admin_note
    registration.handled_by = user
    registration.handled_at = timezone.now()
    registration.save(update_fields=["status", "admin_note", "handled_by", "handled_at", "updated_at"])
    return registration
