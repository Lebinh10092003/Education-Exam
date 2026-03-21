from django.contrib import admin

from .models import (
    Question,
    QuestionAnswerKey,
    QuestionImportBatch,
    QuestionImportError,
    QuestionOption,
    QuestionRevision,
    QuestionTag,
)


class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    extra = 0


class QuestionAnswerKeyInline(admin.StackedInline):
    model = QuestionAnswerKey
    extra = 0


@admin.register(QuestionTag)
class QuestionTagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")


@admin.register(QuestionRevision)
class QuestionRevisionAdmin(admin.ModelAdmin):
    list_display = ("question", "revision_number", "created_by", "created_at")
    search_fields = ("question__id", "question_text")
    inlines = [QuestionOptionInline, QuestionAnswerKeyInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "difficulty", "question_type", "created_at")
    search_fields = ("current_revision__question_text", "subject__name", "subject__code")
    list_filter = ("difficulty", "question_type", "subject")
    filter_horizontal = ("tags",)


class QuestionImportErrorInline(admin.TabularInline):
    model = QuestionImportError
    extra = 0
    readonly_fields = ("row_number", "field_name", "message", "raw_payload")


@admin.register(QuestionImportBatch)
class QuestionImportBatchAdmin(admin.ModelAdmin):
    list_display = ("file_name", "source_format", "status", "success_count", "error_count", "created_at")
    search_fields = ("file_name",)
    list_filter = ("source_format", "status")
    inlines = [QuestionImportErrorInline]
