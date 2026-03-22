from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.platform_core.demo_seed import seed_full_demo_data


class Command(BaseCommand):
    help = "Flush the current database and recreate the full EduExam demo dataset for local end-to-end testing."

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Resetting all business data in the current database..."))
        call_command("flush", interactive=False, verbosity=0)
        summary = seed_full_demo_data()

        self.stdout.write(self.style.SUCCESS("EduExam demo dataset recreated successfully."))
        self.stdout.write("")
        self.stdout.write("Demo login credentials:")
        for item in summary["credentials"]:
            self.stdout.write(f"- {item['label']}: {item['email']} / {item['password']}")
        self.stdout.write("")
        self.stdout.write("Seeded counts:")
        for label, value in summary["counts"].items():
            self.stdout.write(f"- {label}: {value}")
