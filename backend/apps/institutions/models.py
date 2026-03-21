from django.conf import settings
from django.db import models

from apps.platform_core.models import TimeStampedModel


class School(TimeStampedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} ({self.code})"


class CandidateGroup(TimeStampedModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    school = models.ForeignKey(
        School,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="groups",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class GroupMembership(TimeStampedModel):
    group = models.ForeignKey(
        CandidateGroup,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("group__name", "user__email")
        constraints = [
            models.UniqueConstraint(
                fields=("group", "user"),
                name="institutions_unique_group_membership",
            )
        ]

    def __str__(self):
        return f"{self.user} -> {self.group}"
