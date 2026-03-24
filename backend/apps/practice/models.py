from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.platform_core.models import TimeStampedModel


class PracticeSession(TimeStampedModel):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        SUBMITTED = "submitted", "Submitted"
        EXPIRED = "expired", "Expired"
        ABANDONED = "abandoned", "Abandoned"

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="practice_sessions",
    )
    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.PROTECT,
        related_name="practice_sessions",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
    duration_minutes = models.PositiveIntegerField()
    question_count = models.PositiveIntegerField()
    started_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True, blank=True)
    details_retention_until = models.DateTimeField(null=True, blank=True)
    details_purged_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    correct_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    score_percentage = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Practice<{self.candidate_id}:{self.subject.code}:{self.id}>"

    @property
    def details_available(self):
        if self.details_purged_at is not None:
            return False
        if self.details_retention_until is None:
            return True
        return self.details_retention_until > timezone.now()


class PracticeSessionQuestion(TimeStampedModel):
    session = models.ForeignKey(
        PracticeSession,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    source_question = models.ForeignKey(
        "question_bank.Question",
        on_delete=models.PROTECT,
        related_name="practice_snapshots",
    )
    source_revision = models.ForeignKey(
        "question_bank.QuestionRevision",
        on_delete=models.PROTECT,
        related_name="practice_snapshots",
    )
    sort_order = models.PositiveIntegerField()
    difficulty = models.CharField(max_length=16)
    question_type = models.CharField(max_length=32)
    question_text = models.TextField()
    options_payload = models.JSONField(default=list, blank=True)
    correct_option_keys = models.JSONField(default=list, blank=True)
    explanation_text = models.TextField(blank=True)
    selected_option_keys = models.JSONField(default=list, blank=True)
    is_answered = models.BooleanField(default=False)
    is_marked_for_review = models.BooleanField(default=False)
    is_correct = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ("sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("session", "sort_order"),
                name="practice_unique_question_order_per_session",
            )
        ]

    def __str__(self):
        return f"PracticeQuestion<{self.session_id}:{self.sort_order}>"


class PracticeAutosaveSnapshot(TimeStampedModel):
    session = models.ForeignKey(
        PracticeSession,
        on_delete=models.CASCADE,
        related_name="autosave_snapshots",
    )
    payload = models.JSONField(default=dict, blank=True)
    answered_count = models.PositiveIntegerField(default=0)
    marked_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"PracticeAutosave<{self.session_id}:{self.created_at.isoformat()}>"

