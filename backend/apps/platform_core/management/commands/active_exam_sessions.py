from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.exam_delivery.models import ExamSession


class Command(BaseCommand):
    # Lenh van hanh (cron/healthcheck): bo qua system check de chay nhanh, khong in canh bao lap lai.
    requires_system_checks = []
    help = "In so phien thi dang lam bai (con han va co hoat dong gan day). Dung de chan deploy giua ca thi."

    def add_arguments(self, parser):
        parser.add_argument("--active-within", type=int, default=15, help="Phut hoat dong gan nhat (mac dinh 15)")

    def handle(self, *args, **options):
        now = timezone.now()
        recent = now - timedelta(minutes=options["active_within"])
        count = (
            ExamSession.objects.filter(status=ExamSession.Status.IN_PROGRESS, expires_at__gt=now)
            .filter(Q(last_activity_at__gte=recent) | Q(last_activity_at__isnull=True, started_at__gte=recent))
            .count()
        )
        self.stdout.write(str(count))
