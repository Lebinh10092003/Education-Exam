from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.platform_core.models import TimeStampedModel


class ManualGradingTask(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        GRADED = "graded", "Graded"

    session = models.ForeignKey(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="manual_grading_tasks",
    )
    session_question = models.OneToOneField(
        "exam_delivery.SessionQuestion",
        on_delete=models.CASCADE,
        related_name="manual_grading_task",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    max_points = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="graded_manual_tasks",
    )
    graded_at = models.DateTimeField(null=True, blank=True)

    # Diem GOI Y (vd. tu AI qua MCP). Chua phai diem chinh thuc: chi thanh diem khi giao vien duyet.
    suggested_score = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    suggested_feedback = models.TextField(blank=True)
    suggestion_rationale = models.TextField(blank=True)
    # Co can giao vien xem ky: low_confidence, off_topic, possible_copy, prompt_injection, unreadable...
    suggestion_flags = models.JSONField(default=list, blank=True)
    suggestion_source = models.CharField(max_length=64, blank=True)
    suggested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="suggested_manual_grades",
    )
    suggested_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("status", "created_at")

    @property
    def has_suggestion(self):
        return self.suggested_score is not None

    def __str__(self):
        return f"ManualGradingTask<{self.session_id}:{self.session_question_id}>"


class ManualGrade(TimeStampedModel):
    task = models.OneToOneField(
        ManualGradingTask,
        on_delete=models.CASCADE,
        related_name="manual_grade",
    )
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="manual_grades",
    )
    score_awarded = models.DecimalField(max_digits=8, decimal_places=2)
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField()

    def __str__(self):
        return f"ManualGrade<{self.task_id}>"


class Result(TimeStampedModel):
    class WorkflowStatus(models.TextChoices):
        PENDING_GRADING = "pending_grading", "Pending Grading"
        FINALIZED = "finalized", "Finalized"

    class PublishState(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEWING = "reviewing", "Reviewing"
        LOCKED = "locked", "Locked"
        SCHEDULED = "scheduled", "Scheduled"
        PUBLISHED = "published", "Published"

    session = models.OneToOneField(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="result",
    )
    workflow_status = models.CharField(max_length=20, choices=WorkflowStatus.choices)
    publish_state = models.CharField(max_length=16, choices=PublishState.choices, default=PublishState.DRAFT)
    objective_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    manual_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    original_total_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    original_percentage = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    penalty_percent_applied = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    final_total_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    final_percentage = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    total_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    max_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    percentage = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    passed = models.BooleanField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="published_results",
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="locked_results",
    )
    scheduled_publish_at = models.DateTimeField(null=True, blank=True)
    publication_note = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Result<{self.session_id}>"

