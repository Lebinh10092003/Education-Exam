from django.contrib import admin

from .models import Subject


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "color", "is_active", "created_at")
    search_fields = ("name", "code", "description")
    list_filter = ("is_active",)
