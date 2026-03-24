from django.core.management.base import BaseCommand, CommandError

from apps.practice.retention import cleanup_expired_practice_details


class Command(BaseCommand):
    help = "Delete expired practice session details while keeping summary records."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Maximum number of expired practice sessions to process per run.",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        if batch_size <= 0:
            raise CommandError("--batch-size must be greater than 0.")

        result = cleanup_expired_practice_details(batch_size=batch_size)
        self.stdout.write(
            self.style.SUCCESS(
                "Processed {processed} expired practice sessions; deleted {deleted}; failed {failed}.".format(
                    **result,
                )
            )
        )
