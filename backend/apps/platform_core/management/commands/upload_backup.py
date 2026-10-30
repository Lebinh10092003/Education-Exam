"""Doc file sao luu tu stdin va day len R2/S3 (dung boi deploy/backup.sh).

Vi du: docker compose exec -T backend python manage.py upload_backup --name db/x.dump < x.dump
Dung chung khoa R2 cua anh vi pham; co the tach rieng bang BACKUP_S3_* trong .env.production.
"""

import os
import sys
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


def _setting(name, fallback):
    return os.environ.get(name) or fallback


class Command(BaseCommand):
    # Lenh van hanh (cron/healthcheck): bo qua system check de chay nhanh, khong in canh bao lap lai.
    requires_system_checks = []
    help = "Upload ban sao luu (doc tu stdin) len R2/S3 va xoa ban cu hon --keep-days."

    def add_arguments(self, parser):
        parser.add_argument("--name", required=True, help="Duong dan tuong doi, vd. db/eduexam_20260101.dump")
        parser.add_argument("--keep-days", type=int, default=30, help="Xoa ban tren R2 cu hon N ngay (0 = khong xoa)")

    def handle(self, *args, **options):
        try:
            import boto3
        except ImportError as exc:  # pragma: no cover
            raise CommandError("Thieu boto3.") from exc

        bucket = _setting("BACKUP_S3_BUCKET", settings.PROCTORING_EVIDENCE_S3_BUCKET)
        endpoint = _setting("BACKUP_S3_ENDPOINT_URL", settings.PROCTORING_EVIDENCE_S3_ENDPOINT_URL)
        access_key = _setting("BACKUP_S3_ACCESS_KEY_ID", settings.PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID)
        secret_key = _setting("BACKUP_S3_SECRET_ACCESS_KEY", settings.PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY)
        region = _setting("BACKUP_S3_REGION", settings.PROCTORING_EVIDENCE_S3_REGION or "auto")
        prefix = _setting("BACKUP_S3_PREFIX", "backups").strip("/")
        if not all((bucket, endpoint, access_key, secret_key)):
            raise CommandError("Chua cau hinh R2/S3 (bucket, endpoint, access key, secret key).")

        name = options["name"].strip("/")
        if not name or ".." in name.split("/"):
            raise CommandError("Ten file khong hop le.")
        key = f"{prefix}/{name}"

        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )
        client.upload_fileobj(sys.stdin.buffer, bucket, key)
        size = client.head_object(Bucket=bucket, Key=key)["ContentLength"]
        if size == 0:
            raise CommandError(f"File tren R2 rong: {key}")
        self.stdout.write(f"Da upload s3://{bucket}/{key} ({size} bytes)")

        keep_days = options["keep_days"]
        if keep_days <= 0:
            return
        folder = f"{prefix}/{name.rsplit('/', 1)[0]}/" if "/" in name else f"{prefix}/"
        cutoff = timezone.now() - timedelta(days=keep_days)
        removed = 0
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=folder):
            stale = [{"Key": obj["Key"]} for obj in page.get("Contents", []) if obj["LastModified"] < cutoff]
            if stale:
                client.delete_objects(Bucket=bucket, Delete={"Objects": stale, "Quiet": True})
                removed += len(stale)
        if removed:
            self.stdout.write(f"Da xoa {removed} ban sao luu cu hon {keep_days} ngay trong {folder}")
