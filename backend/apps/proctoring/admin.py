from django.contrib import admin

from .models import (
    ClientCapability,
    ProctorEvidence,
    ProctorEvent,
    SessionHeartbeat,
    ViolationCase,
    ViolationReview,
)


@admin.register(ClientCapability)
class ClientCapabilityAdmin(admin.ModelAdmin):
    list_display = ("session", "client_type", "client_version", "updated_at")
    search_fields = ("session__exam__name", "session__candidate__email", "client_version", "user_agent")
    autocomplete_fields = ("session",)


@admin.register(SessionHeartbeat)
class SessionHeartbeatAdmin(admin.ModelAdmin):
    list_display = ("session", "connection_status", "latency_ms", "recorded_at")
    search_fields = ("session__exam__name", "session__candidate__email")
    list_filter = ("connection_status",)
    autocomplete_fields = ("session", "reported_by")


@admin.register(ProctorEvent)
class ProctorEventAdmin(admin.ModelAdmin):
    list_display = ("session", "event_type", "severity", "occurred_at")
    search_fields = ("session__exam__name", "session__candidate__email", "event_type")
    list_filter = ("event_type", "severity")
    autocomplete_fields = ("session", "reported_by")


@admin.register(ProctorEvidence)
class ProctorEvidenceAdmin(admin.ModelAdmin):
    list_display = ("session", "evidence_type", "event", "captured_at")
    search_fields = ("session__exam__name", "session__candidate__email", "evidence_type")
    list_filter = ("evidence_type",)
    autocomplete_fields = ("session", "event", "uploaded_by")


@admin.register(ViolationCase)
class ViolationCaseAdmin(admin.ModelAdmin):
    list_display = ("session", "severity", "status", "title", "created_at")
    search_fields = ("session__exam__name", "session__candidate__email", "title", "summary")
    list_filter = ("status", "severity")
    autocomplete_fields = ("session", "resolved_by")
    filter_horizontal = ("events", "evidences")


@admin.register(ViolationReview)
class ViolationReviewAdmin(admin.ModelAdmin):
    list_display = ("case", "decision", "reviewer", "reviewed_at")
    search_fields = ("case__session__exam__name", "case__session__candidate__email", "notes")
    list_filter = ("decision",)
    autocomplete_fields = ("case", "reviewer")

