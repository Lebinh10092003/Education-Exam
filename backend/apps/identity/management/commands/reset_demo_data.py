from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.platform_core.demo_seed import seed_full_demo_data

# File ghi mat khau mau (da nam trong .gitignore, khong day len git).
CREDENTIALS_FILE = Path(settings.BASE_DIR) / ".demo-credentials.txt"


class Command(BaseCommand):
    help = "Flush the current database and recreate the full EduExam demo dataset for local end-to-end testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=None,
            help="Mat khau chung cho moi tai khoan mau. Bo trong de tao ngau nhien.",
        )
        parser.add_argument(
            "--no-credentials-file",
            action="store_true",
            help="Khong ghi file .demo-credentials.txt.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["password"]:
            self.stdout.write(self.style.WARNING("DEBUG=False: hay chac chan day KHONG phai CSDL that."))
        self.stdout.write(self.style.WARNING("Resetting all business data in the current database..."))
        call_command("flush", interactive=False, verbosity=0)
        summary = seed_full_demo_data(password=options["password"])

        self.stdout.write(self.style.SUCCESS("EduExam demo dataset recreated successfully."))
        self.stdout.write("")
        self.stdout.write("Demo login credentials:")
        for item in summary["credentials"]:
            self.stdout.write(f"- {item['label']}: {item['email']} / {item['password']}")
        self.stdout.write("")
        self.stdout.write("Seeded counts:")
        for label, value in summary["counts"].items():
            self.stdout.write(f"- {label}: {value}")

        if not options["no_credentials_file"]:
            lines = [
                "Tai khoan du lieu mau EduExam (tao boi reset_demo_data).",
                f"Mat khau chung: {summary['password']}",
                "",
                *[f"{item['label']}: {item['username']}  ({item['email']})" for item in summary["accounts"]],
            ]
            CREDENTIALS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
            self.stdout.write("")
            self.stdout.write(f"Da ghi danh sach tai khoan vao {CREDENTIALS_FILE}")
