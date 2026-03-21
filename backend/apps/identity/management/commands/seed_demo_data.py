from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.identity.bootstrap import seed_identity_access


class Command(BaseCommand):
    help = "Seed a minimal demo administrator account for local development."

    def handle(self, *args, **options):
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            email="admin@example.com",
            defaults={
                "full_name": "EduExam Administrator",
                "is_staff": True,
                "is_superuser": True,
                "status": user_model.Status.ACTIVE,
            },
        )
        if created:
            user.set_password("admin123456")
            user.save(update_fields=["password"])

        seed_identity_access(admin_user=user)

        if created:
            self.stdout.write(self.style.SUCCESS("Created demo admin user."))
            return

        self.stdout.write("Demo admin user already exists.")
