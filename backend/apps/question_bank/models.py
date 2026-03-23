from django.conf import settings
from django.db import models
from django.utils.text import slugify

from apps.platform_core.models import TimeStampedModel


class QuestionTag(TimeStampedModel):
    name = models.CharField(max_length=128)
    slug = models.SlugField(unique=True, max_length=160)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Question(TimeStampedModel):
    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    class Type(models.TextChoices):
        MULTIPLE_CHOICE = "multiple_choice", "Multiple Choice"
        ESSAY = "essay", "Essay"
        TRUE_FALSE = "true_false", "True/False"

    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.PROTECT,
        related_name="questions",
    )
    difficulty = models.CharField(max_length=16, choices=Difficulty.choices)
    question_type = models.CharField(max_length=32, choices=Type.choices)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_questions",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_questions",
    )
    tags = models.ManyToManyField(QuestionTag, related_name="questions", blank=True)
    current_revision = models.ForeignKey(
        "question_bank.QuestionRevision",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="current_for_questions",
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.subject.code} - {self.id}"


class QuestionRevision(TimeStampedModel):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    revision_number = models.PositiveIntegerField()
    question_text = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="question_revisions",
    )

    class Meta:
        ordering = ("-revision_number",)
        constraints = [
            models.UniqueConstraint(
                fields=("question", "revision_number"),
                name="question_bank_unique_revision_number",
            )
        ]

    def __str__(self):
        return f"Question {self.question_id} v{self.revision_number}"


class QuestionOption(TimeStampedModel):
    revision = models.ForeignKey(
        QuestionRevision,
        on_delete=models.CASCADE,
        related_name="options",
    )
    key = models.CharField(max_length=8)
    text = models.TextField()
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "key")
        constraints = [
            models.UniqueConstraint(
                fields=("revision", "key"),
                name="question_bank_unique_option_key_per_revision",
            )
        ]

    def __str__(self):
        return f"{self.revision} [{self.key}]"


class QuestionAnswerKey(TimeStampedModel):
    revision = models.OneToOneField(
        QuestionRevision,
        on_delete=models.CASCADE,
        related_name="answer_key",
    )
    correct_option_keys = models.JSONField(default=list, blank=True)
    acceptable_answers = models.JSONField(default=list, blank=True)
    essay_rubric = models.TextField(blank=True)
    sample_answer = models.TextField(blank=True)

    def __str__(self):
        return f"AnswerKey<{self.revision}>"


class QuestionImportBatch(TimeStampedModel):
    class SourceFormat(models.TextChoices):
        CSV = "csv", "CSV"
        JSON = "json", "JSON"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="question_import_batches",
    )
    source_format = models.CharField(max_length=8, choices=SourceFormat.choices)
    file_name = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    total_records = models.PositiveIntegerField(default=0)
    success_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    created_question_ids = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.file_name} ({self.source_format})"


class QuestionImportError(TimeStampedModel):
    batch = models.ForeignKey(
        QuestionImportBatch,
        on_delete=models.CASCADE,
        related_name="errors",
    )
    row_number = models.PositiveIntegerField()
    field_name = models.CharField(max_length=64, blank=True)
    message = models.TextField()
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("row_number", "created_at")

    def __str__(self):
        return f"ImportError<{self.batch_id}:{self.row_number}>"
