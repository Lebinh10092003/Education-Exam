from django.core.management.base import BaseCommand

from apps.exam_authoring.services import sync_exam_lifecycle


class Command(BaseCommand):
    help = "Synchronize exam lifecycle transitions based on schedule windows."

    def handle(self, *args, **options):
        transitioned_exam_ids = sync_exam_lifecycle()
        self.stdout.write(
            self.style.SUCCESS(
                f"Synchronized {len(transitioned_exam_ids)} exam lifecycle transition(s)."
            )
        )
