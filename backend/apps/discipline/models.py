from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.platform_core.models import TimeStampedModel


class ViolationPenaltyProposal(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        NO_PENALTY = "no_penalty", "No Penalty"

    violation_case = models.OneToOneField(
        "proctoring.ViolationCase",
        on_delete=models.CASCADE,
        related_name="penalty_proposal",
    )
    proposed_penalty_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)
    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="proposed_violation_penalties",
    )
    proposed_at = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_violation_penalties",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-updated_at", "-id")

    def __str__(self):
        return f"PenaltyProposal<{self.violation_case_id}:{self.status}>"


class ExamDisciplinaryRecord(TimeStampedModel):
    exam = models.ForeignKey(
        "exam_authoring.Exam",
        on_delete=models.CASCADE,
        related_name="disciplinary_records",
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="disciplinary_records",
    )
    selected_session = models.ForeignKey(
        "exam_delivery.ExamSession",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="disciplinary_records",
    )
    unique_case_count = models.PositiveIntegerField(default=0)
    open_case_count = models.PositiveIntegerField(default=0)
    approved_case_count = models.PositiveIntegerField(default=0)
    highest_approved_penalty_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    original_total_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    original_percentage = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    final_total_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    final_percentage = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    result_publish_state_snapshot = models.CharField(max_length=16, blank=True)
    published_score_synced_at = models.DateTimeField(null=True, blank=True)
    certificate_level_snapshot = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ("exam__name", "candidate__email")
        constraints = [
            models.UniqueConstraint(
                fields=("exam", "candidate"),
                name="discipline_unique_record_per_exam_candidate",
            )
        ]

    def __str__(self):
        return f"DisciplinaryRecord<{self.exam_id}:{self.candidate_id}>"


class ExamDisciplinaryActionLog(TimeStampedModel):
    exam = models.ForeignKey(
        "exam_authoring.Exam",
        on_delete=models.CASCADE,
        related_name="disciplinary_action_logs",
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="disciplinary_action_logs",
    )
    selected_session = models.ForeignKey(
        "exam_delivery.ExamSession",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="disciplinary_action_logs",
    )
    violation_case = models.ForeignKey(
        "proctoring.ViolationCase",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="disciplinary_action_logs",
    )
    proposal = models.ForeignKey(
        ViolationPenaltyProposal,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="action_logs",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="disciplinary_actions",
    )
    action = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-occurred_at", "-id")

    def __str__(self):
        return f"DisciplinaryAction<{self.exam_id}:{self.action}>"


class ExamCertificatePolicy(TimeStampedModel):
    class Mode(models.TextChoices):
        SCORE_THRESHOLD = "score_threshold", "Score Threshold"
        RANK_RATIO = "rank_ratio", "Rank Ratio"
        RANK_RATIO_WITH_MINIMUM = "rank_ratio_with_minimum", "Rank Ratio With Minimum"

    exam = models.OneToOneField(
        "exam_authoring.Exam",
        on_delete=models.CASCADE,
        related_name="certificate_policy",
    )
    mode = models.CharField(max_length=32, choices=Mode.choices, default=Mode.SCORE_THRESHOLD)
    gold_config = models.JSONField(default=dict, blank=True)
    silver_config = models.JSONField(default=dict, blank=True)
    bronze_config = models.JSONField(default=dict, blank=True)
    encouragement_config = models.JSONField(default=dict, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_certificate_policies",
    )

    class Meta:
        ordering = ("exam__name",)

    def __str__(self):
        return f"CertificatePolicy<{self.exam_id}:{self.mode}>"


class ExamCertificateAward(TimeStampedModel):
    class Level(models.TextChoices):
        GOLD = "gold", "Gold"
        SILVER = "silver", "Silver"
        BRONZE = "bronze", "Bronze"
        ENCOURAGEMENT = "encouragement", "Encouragement"
        PARTICIPATION = "participation", "Participation"

    exam = models.ForeignKey(
        "exam_authoring.Exam",
        on_delete=models.CASCADE,
        related_name="certificate_awards",
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="certificate_awards",
    )
    selected_session = models.ForeignKey(
        "exam_delivery.ExamSession",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="certificate_awards",
    )
    award_level = models.CharField(max_length=32, choices=Level.choices)
    basis_total_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    basis_percentage = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    policy_snapshot = models.JSONField(default=dict, blank=True)
    awarded_at = models.DateTimeField(default=timezone.now)
    recomputed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("exam__name", "candidate__email")
        constraints = [
            models.UniqueConstraint(
                fields=("exam", "candidate"),
                name="discipline_unique_certificate_award_per_exam_candidate",
            )
        ]

    def __str__(self):
        return f"CertificateAward<{self.exam_id}:{self.candidate_id}:{self.award_level}>"
