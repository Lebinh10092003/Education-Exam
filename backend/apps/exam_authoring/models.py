from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.platform_core.models import TimeStampedModel
from apps.question_bank.models import Question


class Exam(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SCHEDULED = "scheduled", "Scheduled"
        OPEN = "open", "Open"
        PAUSED = "paused", "Paused"
        CLOSED = "closed", "Closed"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=255)
    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.PROTECT,
        related_name="exams",
    )
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    duration_minutes = models.PositiveIntegerField(default=60)
    passing_score = models.PositiveIntegerField(default=60)
    max_attempts = models.PositiveIntegerField(default=1)
    shuffle_questions = models.BooleanField(default=False)
    show_results_immediately = models.BooleanField(default=False)
    enable_proctoring = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_exams",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_exams",
    )
    current_version = models.ForeignKey(
        "exam_authoring.ExamVersion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="current_for_exams",
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.name


class ExamVersion(TimeStampedModel):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="exam_versions",
    )

    class Meta:
        ordering = ("-version_number",)
        constraints = [
            models.UniqueConstraint(
                fields=("exam", "version_number"),
                name="exam_authoring_unique_version_number",
            )
        ]

    def __str__(self):
        return f"{self.exam.name} v{self.version_number}"


class ExamItem(TimeStampedModel):
    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        RANDOM = "random", "Random"

    version = models.ForeignKey(
        ExamVersion,
        on_delete=models.CASCADE,
        related_name="items",
    )
    question_revision = models.ForeignKey(
        "question_bank.QuestionRevision",
        on_delete=models.PROTECT,
        related_name="exam_items",
    )
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL)
    sort_order = models.PositiveIntegerField(default=1)
    points = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("1.00"))

    class Meta:
        ordering = ("sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("version", "question_revision"),
                name="exam_authoring_unique_revision_per_version",
            )
        ]

    def __str__(self):
        return f"{self.version} -> {self.question_revision}"


class ExamRandomRule(TimeStampedModel):
    version = models.ForeignKey(
        ExamVersion,
        on_delete=models.CASCADE,
        related_name="random_rules",
    )
    sort_order = models.PositiveIntegerField(default=1)
    difficulty = models.CharField(max_length=16, choices=Question.Difficulty.choices, blank=True)
    question_type = models.CharField(max_length=32, choices=Question.Type.choices, blank=True)
    tag_ids = models.JSONField(default=list, blank=True)
    count = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ("sort_order", "id")

    def __str__(self):
        return f"{self.version} rule #{self.sort_order}"


class ExamScheduleWindow(TimeStampedModel):
    exam = models.OneToOneField(
        Exam,
        on_delete=models.CASCADE,
        related_name="schedule_window",
    )
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Schedule<{self.exam.name}>"


class ExamAssignment(TimeStampedModel):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    group = models.ForeignKey(
        "institutions.CandidateGroup",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="exam_assignments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="exam_assignments",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="managed_exam_assignments",
    )

    class Meta:
        ordering = ("exam__name", "group__name", "user__email")
        constraints = [
            models.UniqueConstraint(
                fields=("exam", "group"),
                name="exam_authoring_unique_group_assignment",
            ),
            models.UniqueConstraint(
                fields=("exam", "user"),
                name="exam_authoring_unique_user_assignment",
            ),
            models.CheckConstraint(
                condition=(
                    (Q(group__isnull=False) & Q(user__isnull=True))
                    | (Q(group__isnull=True) & Q(user__isnull=False))
                ),
                name="exam_authoring_assignment_single_target",
            ),
        ]

    def __str__(self):
        target = self.group or self.user
        return f"{self.exam} -> {target}"
