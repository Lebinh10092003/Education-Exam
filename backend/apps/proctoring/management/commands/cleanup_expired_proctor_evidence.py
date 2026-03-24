from django.core.management.base import BaseCommand, CommandError

from apps.proctoring.retention import cleanup_expired_proctor_evidence


class Command(BaseCommand):
    help = "Delete expired proctoring evidence files and mark their records as deleted."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Maximum number of expired evidence records to process per run.",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        if batch_size <= 0:
            raise CommandError("--batch-size must be greater than 0.")

        result = cleanup_expired_proctor_evidence(batch_size=batch_size)
        self.stdout.write(
            self.style.SUCCESS(
                "Processed {processed} expired evidence records; deleted {deleted}; failed {failed}.".format(
                    **result,
                )
            )
        )
