from django.contrib import admin

from .models import Material


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("title", "subject", "uploaded_by", "download_count", "is_active", "created_at")
    list_filter = ("subject", "is_active", "created_at")
    search_fields = ("title", "description", "subject__name", "uploaded_by__email")

