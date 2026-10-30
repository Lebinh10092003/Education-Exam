"""
Cuoc thi Olympiad gioi thieu tren trang chu va phieu dang ky du thi cua phu huynh/hoc sinh.

Truoc day ca hai deu ghi cung trong frontend va phieu dang ky KHONG duoc gui ve server.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.platform_core.models import TimeStampedModel


class Competition(TimeStampedModel):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Sắp diễn ra"
        ONGOING = "ongoing", "Đang diễn ra"
        ENDED = "ended", "Đã kết thúc"

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=32, help_text="Mã viết tắt, vd. IMO, SCO IEO.")
    description = models.TextField(blank=True)
    cycle = models.CharField(max_length=64, blank=True, help_text="Chu kỳ / mùa thi, vd. 3 hoặc 2026-2027.")
    exam_date = models.DateField()
    registration_deadline = models.DateField(null=True, blank=True)
    registration_open = models.BooleanField(default=True, help_text="Cho phép chọn cuộc thi này khi đăng ký.")
    is_featured = models.BooleanField(default=True, help_text="Hiển thị trong bảng 'Các cuộc thi nổi bật' trên trang chủ.")
    is_active = models.BooleanField(default=True, help_text="Tắt để ẩn hoàn toàn khỏi trang công khai.")
    sort_order = models.PositiveIntegerField(default=0)
    info_url = models.URLField(blank=True)

    class Meta:
        ordering = ("-exam_date", "sort_order", "id")
        indexes = [models.Index(fields=["is_active", "exam_date"], name="comp_active_date_idx")]

    def __str__(self):
        return f"{self.code} ({self.cycle})" if self.cycle else self.code

    def status_on(self, today=None):
        today = today or timezone.localdate()
        if today < self.exam_date:
            return self.Status.UPCOMING
        return self.Status.ONGOING if today == self.exam_date else self.Status.ENDED

    def accepts_registration_on(self, today=None):
        today = today or timezone.localdate()
        if not (self.is_active and self.registration_open) or today > self.exam_date:
            return False
        return self.registration_deadline is None or today <= self.registration_deadline


class CompetitionRegistration(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "new", "Mới"
        CONTACTED = "contacted", "Đã liên hệ"
        CONFIRMED = "confirmed", "Đã xác nhận"
        REJECTED = "rejected", "Từ chối"

    full_name = models.CharField(max_length=255)
    date_of_birth = models.DateField()
    grade = models.CharField(max_length=32)
    school = models.CharField(max_length=255)
    class_name = models.CharField(max_length=64, blank=True)
    cccd = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)
    ward = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=255, blank=True)
    email = models.EmailField()
    guardian_phone = models.CharField(max_length=32)
    competitions = models.ManyToManyField(Competition, related_name="registrations")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    admin_note = models.TextField(blank=True)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="handled_registrations"
    )
    handled_at = models.DateTimeField(null=True, blank=True)
    source_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [models.Index(fields=["status", "-created_at"], name="compreg_status_created_idx")]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"
