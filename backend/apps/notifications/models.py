from django.conf import settings
from django.db import models

from apps.platform_core.models import TimeStampedModel


class Notification(TimeStampedModel):
    class Category(models.TextChoices):
        EXAM = "exam", "Exam"
        SUBMISSION = "submission", "Submission"
        GRADING = "grading", "Grading"
        USER = "user", "User"
        SYSTEM = "system", "System"
        ALERT = "alert", "Alert"
        RESULT = "result", "Result"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    category = models.CharField(max_length=64, choices=Category.choices, default=Category.SYSTEM)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    action_url = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("is_read", "-created_at", "-id")

    def __str__(self):
        return f"Notification<{self.recipient_id}:{self.title}>"
