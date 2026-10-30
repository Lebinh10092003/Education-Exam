from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.platform_core.health import scheduler_heartbeat_age


class Command(BaseCommand):
    # Lenh van hanh (cron/healthcheck): bo qua system check de chay nhanh, khong in canh bao lap lai.
    requires_system_checks = []
    help = "Healthcheck cho container beat: loi neu Celery beat/worker khong ghi nhip tim gan day."

    def add_arguments(self, parser):
        parser.add_argument("--max-age", type=int, default=None, help="So giay toi da (mac dinh theo settings)")

    def handle(self, *args, **options):
        max_age = options["max_age"] or settings.SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS or 300
        age = scheduler_heartbeat_age()
        if age is None:
            raise CommandError("Chua co nhip tim scheduler.")
        if age > max_age:
            raise CommandError(f"Nhip tim scheduler cu {int(age)}s (> {max_age}s).")
        self.stdout.write(f"ok ({int(age)}s)")
