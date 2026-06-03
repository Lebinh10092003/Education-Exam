from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.platform_core.models import TimeStampedModel


class ExamSession(TimeStampedModel):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        SUBMITTED = "submitted", "Submitted"
        EXPIRED = "expired", "Expired"
        TERMINATED = "terminated", "Terminated"

    exam = models.ForeignKey(
        "exam_authoring.Exam",
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="exam_sessions",
    )
    exam_version = models.ForeignKey(
        "exam_authoring.ExamVersion",
        on_delete=models.PROTECT,
        related_name="delivery_sessions",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
    attempt_number = models.PositiveIntegerField()
    started_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    paused_at = models.DateTimeField(null=True, blank=True)
    remaining_seconds_at_pause = models.PositiveIntegerField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    objective_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    max_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    manual_grading_required = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            # Toi uu query 'tim session dang active cua thi sinh' (hay goi nhat)
            models.Index(fields=["candidate", "exam", "status"], name="es_cand_exam_status_idx"),
            # Toi uu query 'tat ca session cua mot bai thi' (proctor/admin)
            models.Index(fields=["exam", "status"], name="es_exam_status_idx"),
            # Toi uu query loc theo status
            models.Index(fields=["status"], name="es_status_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("exam", "candidate", "attempt_number"),
                name="exam_delivery_unique_attempt_per_candidate_exam",
            )
        ]

    def __str__(self):
        return f"{self.exam.name} / {self.candidate.email} / attempt {self.attempt_number}"


class SessionQuestion(TimeStampedModel):
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    exam_item = models.ForeignKey(
        "exam_authoring.ExamItem",
        on_delete=models.PROTECT,
        related_name="session_questions",
    )
    question_revision = models.ForeignKey(
        "question_bank.QuestionRevision",
        on_delete=models.PROTECT,
        related_name="session_questions",
    )
    sort_order = models.PositiveIntegerField()
    points = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1.00"))
    is_marked_for_review = models.BooleanField(default=False)

    class Meta:
        ordering = ("sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("session", "sort_order"),
                name="exam_delivery_unique_question_order_per_session",
            ),
            models.UniqueConstraint(
                fields=("session", "exam_item"),
                name="exam_delivery_unique_exam_item_per_session",
            ),
        ]

    def __str__(self):
        return f"{self.session} / question {self.sort_order}"


class SessionAnswer(TimeStampedModel):
    session_question = models.OneToOneField(
        SessionQuestion,
        on_delete=models.CASCADE,
        related_name="answer",
    )
    selected_option_keys = models.JSONField(default=list, blank=True)
    answer_text = models.TextField(blank=True)
    is_answered = models.BooleanField(default=False)
    is_correct = models.BooleanField(null=True, blank=True)
    awarded_points = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"Answer<{self.session_question_id}>"


class AutosaveSnapshot(TimeStampedModel):
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="autosave_snapshots",
    )
    payload = models.JSONField(default=dict, blank=True)
    answered_count = models.PositiveIntegerField(default=0)
    marked_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Autosave<{self.session_id}:{self.created_at.isoformat()}>"


class Submission(TimeStampedModel):
    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        AUTO_TIMEOUT = "auto_timeout", "Auto Timeout"
        FORCED_CLOSE = "forced_close", "Forced Close"

    session = models.OneToOneField(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="submission",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="exam_submissions",
    )
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL)
    checksum = models.CharField(max_length=128, blank=True)
    answered_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Submission<{self.session_id}>"

