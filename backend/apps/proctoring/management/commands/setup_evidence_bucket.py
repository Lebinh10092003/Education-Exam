import json
import uuid

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.proctoring import evidence_storage
from apps.proctoring.evidence_storage import (
    build_bucket_cors_rules,
    build_bucket_lifecycle_rules,
    evidence_storage_uses_s3,
    sanitize_path_segment,
)

# Giai thich loi thuong gap khi cau hinh R2/S3.
_ERROR_HINTS = {
    "InvalidAccessKeyId": "Access Key ID sai (R2: 32 ky tu, lay o R2 > Manage R2 API Tokens).",
    "SignatureDoesNotMatch": "Secret Access Key sai, hoac endpoint/region khong dung (R2 dung region 'auto').",
    "NoSuchBucket": "Khong tim thay bucket. Kiem tra ten bucket va endpoint (endpoint KHONG kem ten bucket).",
    "AccessDenied": "Token khong co quyen voi bucket nay. Can quyen 'Object Read & Write' (va 'Admin' de dat CORS/lifecycle).",
    "Unauthorized": "Token khong hop le hoac da bi thu hoi.",
}


def _explain(exc):
    code = getattr(exc, "response", {}).get("Error", {}).get("Code", "") if hasattr(exc, "response") else ""
    hint = _ERROR_HINTS.get(code, "")
    return f"{code or type(exc).__name__}: {exc}" + (f"\n  -> {hint}" if hint else "")


class Command(BaseCommand):
    help = (
        "Cau hinh bucket S3/R2 chua anh bang chung: CORS cho phep trinh duyet tai thang len, "
        "va lifecycle tu xoa anh sau thoi gian luu tru. Dung --check de kiem tra ket noi."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--origin",
            action="append",
            dest="origins",
            help="Domain frontend duoc phep upload (lap lai de them nhieu). Mac dinh: FRONTEND_BASE_URL.",
        )
        parser.add_argument(
            "--extra-days",
            type=int,
            default=7,
            help="So ngay cong them vao PROCTORING_EVIDENCE_RETENTION_DAYS cho lifecycle (du phong cho tac vu don dep).",
        )
        parser.add_argument("--dry-run", action="store_true", help="Chi in cau hinh, khong goi API.")
        parser.add_argument(
            "--check",
            action="store_true",
            help="Chi kiem tra ket noi: doc bucket, ghi va xoa 1 file thu. Khong doi cau hinh bucket.",
        )

    def _print_config(self):
        key_id = settings.PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID or ""
        masked = f"{key_id[:4]}...{key_id[-4:]} ({len(key_id)} ky tu)" if key_id else "(trong)"
        self.stdout.write(f"  Kho luu tru : {settings.PROCTORING_EVIDENCE_STORAGE}")
        self.stdout.write(f"  Endpoint    : {settings.PROCTORING_EVIDENCE_S3_ENDPOINT_URL or '(trong)'}")
        self.stdout.write(f"  Bucket      : {settings.PROCTORING_EVIDENCE_S3_BUCKET or '(trong)'}")
        self.stdout.write(f"  Region      : {settings.PROCTORING_EVIDENCE_S3_REGION}")
        self.stdout.write(f"  Access key  : {masked}")
        self.stdout.write(
            f"  Secret key  : {'da dat' if settings.PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY else '(trong)'}"
        )

    def _check_connection(self):
        client = evidence_storage.get_evidence_s3_client()
        bucket = settings.PROCTORING_EVIDENCE_S3_BUCKET
        root = sanitize_path_segment(settings.PROCTORING_EVIDENCE_ROOT_FOLDER)
        test_key = f"{root}/_kiem-tra-ket-noi/{uuid.uuid4().hex}.webp"

        steps = [
            ("Doc bucket", lambda: client.head_bucket(Bucket=bucket)),
            (
                "Ghi file thu",
                lambda: client.put_object(Bucket=bucket, Key=test_key, Body=b"ok", ContentType="image/webp"),
            ),
            ("Doc file thu", lambda: client.head_object(Bucket=bucket, Key=test_key)),
            ("Xoa file thu", lambda: client.delete_object(Bucket=bucket, Key=test_key)),
        ]
        for label, action in steps:
            try:
                action()
            except Exception as exc:  # noqa: BLE001 - in loi than thien cho nguoi van hanh
                raise CommandError(f"{label}: THAT BAI\n  {_explain(exc)}") from exc
            self.stdout.write(self.style.SUCCESS(f"  {label}: OK"))

    def handle(self, *args, **options):
        origins = options.get("origins") or [settings.FRONTEND_BASE_URL.rstrip("/")]
        expire_days = int(settings.PROCTORING_EVIDENCE_RETENTION_DAYS) + max(int(options["extra_days"]), 0)
        cors = build_bucket_cors_rules(allowed_origins=origins)
        lifecycle = build_bucket_lifecycle_rules(
            root_folder=settings.PROCTORING_EVIDENCE_ROOT_FOLDER,
            expire_days=expire_days,
        )

        if options["dry_run"]:
            self.stdout.write(json.dumps({"cors": cors, "lifecycle": lifecycle}, ensure_ascii=False, indent=2))
            return

        self.stdout.write("Cau hinh hien tai:")
        self._print_config()

        if not evidence_storage_uses_s3():
            raise CommandError("PROCTORING_EVIDENCE_STORAGE chua dat la 's3'.")
        missing = [
            name
            for name, value in (
                ("PROCTORING_EVIDENCE_S3_ENDPOINT_URL", settings.PROCTORING_EVIDENCE_S3_ENDPOINT_URL),
                ("PROCTORING_EVIDENCE_S3_BUCKET", settings.PROCTORING_EVIDENCE_S3_BUCKET),
                ("PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID", settings.PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID),
                ("PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY", settings.PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY),
            )
            if not value
        ]
        if missing:
            raise CommandError("Thieu bien cau hinh: " + ", ".join(missing))

        self.stdout.write("Kiem tra ket noi:")
        self._check_connection()
        if options["check"]:
            self.stdout.write(self.style.SUCCESS("Ket noi R2/S3 hoat dong binh thuong."))
            return

        bucket = settings.PROCTORING_EVIDENCE_S3_BUCKET
        client = evidence_storage.get_evidence_s3_client()
        try:
            client.put_bucket_cors(Bucket=bucket, CORSConfiguration=cors)
            client.put_bucket_lifecycle_configuration(Bucket=bucket, LifecycleConfiguration=lifecycle)
        except Exception as exc:  # noqa: BLE001
            raise CommandError(
                "Khong dat duoc CORS/lifecycle (token can quyen Admin Read & Write cho bucket):\n  " + _explain(exc)
            ) from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"Da cau hinh bucket '{bucket}': CORS cho {', '.join(origins)}; "
                f"tu xoa anh trong '{settings.PROCTORING_EVIDENCE_ROOT_FOLDER}/' sau {expire_days} ngay."
            )
        )
