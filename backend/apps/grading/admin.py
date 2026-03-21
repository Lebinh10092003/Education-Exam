from django.contrib import admin

from .models import ManualGrade, ManualGradingTask, Result


@admin.register(ManualGradingTask)
class ManualGradingTaskAdmin(admin.ModelAdmin):
    list_display = ("session", "session_question", "status", "max_points", "graded_by", "graded_at")
    search_fields = (
        "session__exam__name",
        "session__candidate__email",
        "session_question__question_revision__question_text",
    )
    list_filter = ("status", "session__exam__subject")
    autocomplete_fields = ("session", "graded_by")


@admin.register(ManualGrade)
class ManualGradeAdmin(admin.ModelAdmin):
    list_display = ("task", "score_awarded", "graded_by", "graded_at")
    search_fields = ("task__session__exam__name", "task__session__candidate__email", "feedback")
    autocomplete_fields = ("task", "graded_by")


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ("session", "workflow_status", "publish_state", "total_score", "percentage", "passed")
    search_fields = ("session__exam__name", "session__candidate__email")
    list_filter = ("workflow_status", "publish_state", "passed")
    autocomplete_fields = ("session", "published_by")

