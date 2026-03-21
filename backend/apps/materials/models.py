from django.conf import settings
from django.db import models

from apps.platform_core.models import TimeStampedModel


class Material(TimeStampedModel):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        related_name="materials",
    )
    file = models.FileField(upload_to="materials/")
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    mime_type = models.CharField(max_length=128, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_materials",
    )
    download_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-created_at", "title")

    def __str__(self):
        return self.title

