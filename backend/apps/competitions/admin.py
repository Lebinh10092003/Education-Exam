from django.contrib import admin

from .models import Competition, CompetitionRegistration


@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "cycle", "exam_date", "is_featured", "is_active")
    list_filter = ("is_active", "is_featured")
    search_fields = ("code", "name")


@admin.register(CompetitionRegistration)
class CompetitionRegistrationAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "guardian_phone", "school", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("full_name", "email", "guardian_phone", "school", "cccd")
