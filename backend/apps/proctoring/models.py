from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.platform_core.models import TimeStampedModel


def _default_proctor_evidence_expiry():
    return timezone.now() + timezone.timedelta(days=settings.PROCTORING_EVIDENCE_RETENTION_DAYS)


class ClientCapability(TimeStampedModel):
    class ClientType(models.TextChoices):
        WEB = "web", "Web"
        NATIVE = "native", "Native"

    session = models.OneToOneField(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="client_capability",
    )
    client_type = models.CharField(max_length=16, choices=ClientType.choices)
    client_version = models.CharField(max_length=64, blank=True)
    capabilities = models.JSONField(default=dict, blank=True)
    attestation_payload = models.JSONField(default=dict, blank=True)
    user_agent = models.TextField(blank=True)

    def __str__(self):
        return f"ClientCapability<{self.session_id}:{self.client_type}>"


class ProctoringMediaState(TimeStampedModel):
    class PublishStatus(models.TextChoices):
        IDLE = "idle", "Idle"
        PUBLISHING = "publishing", "Publishing"
        FAILED = "failed", "Failed"
        STOPPED = "stopped", "Stopped"

    class CaptureStatus(models.TextChoices):
        UNAVAILABLE = "unavailable", "Unavailable"
        READY = "ready", "Ready"
        REVOKED = "revoked", "Revoked"
        FAILED = "failed", "Failed"

    session = models.OneToOneField(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="proctoring_media_state",
    )
    provider = models.CharField(max_length=32, default=settings.PROCTORING_MEDIA_PROVIDER)
    room_name = models.CharField(max_length=255, blank=True)
    participant_name = models.CharField(max_length=255, blank=True)
    webcam_publish_status = models.CharField(
        max_length=16,
        choices=PublishStatus.choices,
        default=PublishStatus.IDLE,
    )
    screen_capture_status = models.CharField(
        max_length=16,
        choices=CaptureStatus.choices,
        default=CaptureStatus.UNAVAILABLE,
    )
    webcam_publish_error = models.TextField(blank=True)
    last_publish_at = models.DateTimeField(null=True, blank=True)
    last_status_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"ProctoringMediaState<{self.session_id}:{self.webcam_publish_status}>"


class SessionHeartbeat(TimeStampedModel):
    class ConnectionStatus(models.TextChoices):
        STABLE = "stable", "Stable"
        UNSTABLE = "unstable", "Unstable"
        OFFLINE = "offline", "Offline"

    session = models.ForeignKey(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="heartbeats",
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reported_heartbeats",
    )
    connection_status = models.CharField(max_length=16, choices=ConnectionStatus.choices)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    recorded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-recorded_at", "-id")
        indexes = [
            models.Index(fields=["-recorded_at"], name="sh_recorded_at_idx"),
        ]

    def __str__(self):
        return f"Heartbeat<{self.session_id}:{self.connection_status}>"


class ProctorEvent(TimeStampedModel):
    class EventType(models.TextChoices):
        TAB_SWITCH = "tab_switch", "Tab Switch"
        FULLSCREEN_EXIT = "fullscreen_exit", "Fullscreen Exit"
        CONNECTION_UNSTABLE = "connection_unstable", "Connection Unstable"
        WEBCAM_CAPTURE = "webcam_capture", "Webcam Capture"
        SCREEN_CAPTURE = "screen_capture", "Screen Capture"
        MANUAL_ALERT = "manual_alert", "Manual Alert"

    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    session = models.ForeignKey(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="proctor_events",
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reported_proctor_events",
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.INFO)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-occurred_at", "-id")

    def __str__(self):
        return f"ProctorEvent<{self.session_id}:{self.event_type}>"


class ProctorEvidence(TimeStampedModel):
    class EvidenceType(models.TextChoices):
        WEBCAM_SNAPSHOT = "webcam_snapshot", "Webcam Snapshot"
        SCREEN_CAPTURE = "screen_capture", "Screen Capture"
        ATTACHMENT = "attachment", "Attachment"

    session = models.ForeignKey(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="proctor_evidences",
    )
    event = models.ForeignKey(
        ProctorEvent,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="evidences",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_proctor_evidences",
    )
    evidence_type = models.CharField(max_length=32, choices=EvidenceType.choices)
    file = models.FileField(upload_to="proctoring/evidence/")
    metadata = models.JSONField(default=dict, blank=True)
    captured_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(default=_default_proctor_evidence_expiry)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deletion_error = models.TextField(blank=True)

    class Meta:
        ordering = ("-captured_at", "-id")

    def __str__(self):
        return f"ProctorEvidence<{self.session_id}:{self.evidence_type}>"


class ViolationCase(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    session = models.ForeignKey(
        "exam_delivery.ExamSession",
        on_delete=models.CASCADE,
        related_name="violation_cases",
    )
    severity = models.CharField(max_length=16, choices=ProctorEvent.Severity.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    events = models.ManyToManyField(ProctorEvent, related_name="violation_cases", blank=True)
    evidences = models.ManyToManyField(ProctorEvidence, related_name="violation_cases", blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_violation_cases",
    )
    resolution_notes = models.TextField(blank=True)

    class Meta:
        ordering = ("status", "-created_at")

    def __str__(self):
        return f"ViolationCase<{self.session_id}:{self.status}>"


class ViolationReview(TimeStampedModel):
    class Decision(models.TextChoices):
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    case = models.ForeignKey(
        ViolationCase,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="violation_reviews",
    )
    decision = models.CharField(max_length=16, choices=Decision.choices)
    notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-reviewed_at", "-id")

    def __str__(self):
        return f"ViolationReview<{self.case_id}:{self.decision}>"

