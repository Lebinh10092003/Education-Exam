from django.contrib import admin

from .models import AutosaveSnapshot, ExamSession, SessionAnswer, SessionQuestion, Submission


class SessionQuestionInline(admin.TabularInline):
    model = SessionQuestion
    extra = 0
    readonly_fields = ("sort_order", "question_revision", "points")


@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    list_display = (
        "exam",
        "candidate",
        "attempt_number",
        "status",
        "started_at",
        "expires_at",
        "submitted_at",
    )
    list_filter = ("status", "exam__subject")
    search_fields = ("exam__name", "candidate__email")
    autocomplete_fields = ("exam", "candidate", "exam_version")
    inlines = [SessionQuestionInline]


@admin.register(SessionQuestion)
class SessionQuestionAdmin(admin.ModelAdmin):
    list_display = ("session", "sort_order", "question_revision", "points", "is_marked_for_review")
    search_fields = ("session__exam__name", "session__candidate__email", "question_revision__question_text")
    autocomplete_fields = ("session",)


@admin.register(SessionAnswer)
class SessionAnswerAdmin(admin.ModelAdmin):
    list_display = ("session_question", "is_answered", "is_correct", "awarded_points", "updated_at")
    autocomplete_fields = ("session_question",)


@admin.register(AutosaveSnapshot)
class AutosaveSnapshotAdmin(admin.ModelAdmin):
    list_display = ("session", "answered_count", "marked_count", "created_at")
    autocomplete_fields = ("session",)


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("session", "submitted_by", "source", "answered_count", "created_at")
    autocomplete_fields = ("session", "submitted_by")
