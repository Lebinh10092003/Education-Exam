from django.db import models

from apps.platform_core.models import TimeStampedModel


class Subject(TimeStampedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=32, default="bg-blue-600")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} ({self.code})"
