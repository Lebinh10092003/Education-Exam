from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from apps.identity.api_tokens import create_api_token


class Command(BaseCommand):
    help = "Tao ma truy cap MCP cho 1 tai khoan quan tri (ma chi hien 1 lan)."

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True, help="Email hoac ten dang nhap")
        parser.add_argument("--name", default="MCP")
        parser.add_argument("--days", type=int, default=90, help="So ngay hieu luc (0 = khong het han)")

    def handle(self, *args, **options):
        identifier = options["user"].strip()
        user = get_user_model().objects.filter(Q(email__iexact=identifier) | Q(username__iexact=identifier)).first()
        if user is None:
            raise CommandError(f"Khong tim thay tai khoan '{identifier}'.")
        if not user.is_staff:
            raise CommandError("Chi tai khoan quan tri (is_staff) moi duoc tao ma MCP.")
        token, raw = create_api_token(user=user, name=options["name"], expires_in_days=options["days"])
        expiry = token.expires_at.strftime("%d/%m/%Y") if token.expires_at else "khong het han"
        self.stdout.write(self.style.SUCCESS(f"Ma truy cap MCP cho {user.email} (het han: {expiry}):"))
        self.stdout.write(raw)
        self.stdout.write("Luu lai ngay - ma nay se khong hien lai.")
