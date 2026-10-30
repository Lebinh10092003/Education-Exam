from django.apps import AppConfig


class PlatformCoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.platform_core"
    label = "platform_core"

    def ready(self):
        from apps.platform_core import checks  # noqa: F401 - dang ky system check
