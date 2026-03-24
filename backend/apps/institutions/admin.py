from django.contrib import admin

from .models import CandidateGroup, GroupMembership, School


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active", "created_at")
    search_fields = ("name", "code")
    list_filter = ("is_active",)


@admin.register(CandidateGroup)
class CandidateGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    search_fields = ("name", "description")
    list_filter = ("is_active",)


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("group", "user", "is_active", "created_at")
    search_fields = ("group__name", "user__email", "user__full_name")
    list_filter = ("is_active", "group")
