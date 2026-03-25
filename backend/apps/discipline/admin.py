from django.contrib import admin

from .models import (
    ExamCertificateAward,
    ExamCertificatePolicy,
    ExamDisciplinaryActionLog,
    ExamDisciplinaryRecord,
    ViolationPenaltyProposal,
)


@admin.register(ViolationPenaltyProposal)
class ViolationPenaltyProposalAdmin(admin.ModelAdmin):
    list_display = ("violation_case", "proposed_penalty_percent", "status", "proposed_by", "approved_by")
    list_filter = ("status",)
    search_fields = ("violation_case__session__candidate__email", "violation_case__title")


@admin.register(ExamDisciplinaryRecord)
class ExamDisciplinaryRecordAdmin(admin.ModelAdmin):
    list_display = (
        "exam",
        "candidate",
        "selected_session",
        "highest_approved_penalty_percent",
        "original_total_score",
        "final_total_score",
        "certificate_level_snapshot",
    )
    list_filter = ("exam",)
    search_fields = ("candidate__email", "candidate__full_name", "exam__name")


@admin.register(ExamDisciplinaryActionLog)
class ExamDisciplinaryActionLogAdmin(admin.ModelAdmin):
    list_display = ("action", "exam", "candidate", "actor", "occurred_at")
    list_filter = ("action", "exam")
    search_fields = ("candidate__email", "exam__name")


@admin.register(ExamCertificatePolicy)
class ExamCertificatePolicyAdmin(admin.ModelAdmin):
    list_display = ("exam", "mode", "updated_by", "updated_at")
    list_filter = ("mode",)
    search_fields = ("exam__name",)


@admin.register(ExamCertificateAward)
class ExamCertificateAwardAdmin(admin.ModelAdmin):
    list_display = ("exam", "candidate", "award_level", "basis_percentage", "selected_session", "recomputed_at")
    list_filter = ("award_level", "exam")
    search_fields = ("candidate__email", "candidate__full_name", "exam__name")
