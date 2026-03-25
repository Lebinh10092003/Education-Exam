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

    class Meta:
        ordering = ("status", "created_at")

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

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Result<{self.session_id}>"

