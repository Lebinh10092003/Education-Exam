from django.contrib import admin

from .models import Exam, ExamAssignment, ExamItem, ExamRandomRule, ExamScheduleWindow, ExamVersion


class ExamItemInline(admin.TabularInline):
    model = ExamItem
    extra = 0


class ExamRandomRuleInline(admin.TabularInline):
    model = ExamRandomRule
    extra = 0


class ExamVersionInline(admin.TabularInline):
    model = ExamVersion
    extra = 0
    readonly_fields = ("version_number", "created_by", "created_at")


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("name", "mode", "subject", "status", "duration_minutes", "max_attempts", "created_at")
    list_filter = ("mode", "status", "subject", "shuffle_questions", "enable_proctoring")
    search_fields = ("name", "subject__name", "subject__code")
    autocomplete_fields = ("subject", "created_by", "updated_by", "current_version")
    inlines = [ExamVersionInline]


@admin.register(ExamVersion)
class ExamVersionAdmin(admin.ModelAdmin):
    list_display = ("exam", "version_number", "created_by", "created_at")
    search_fields = ("exam__name", "exam__subject__name")
    autocomplete_fields = ("exam", "created_by")
    inlines = [ExamItemInline, ExamRandomRuleInline]


@admin.register(ExamScheduleWindow)
class ExamScheduleWindowAdmin(admin.ModelAdmin):
    list_display = ("exam", "opens_at", "closes_at")
    autocomplete_fields = ("exam",)

@admin.register(ExamAssignment)
class ExamAssignmentAdmin(admin.ModelAdmin):
    list_display = ("exam", "group", "user", "assigned_by", "created_at")
    list_filter = ("group",)
    search_fields = ("exam__name", "group__name", "user__email")
    autocomplete_fields = ("exam", "group", "user", "assigned_by")
