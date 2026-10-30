from datetime import date

from django.db import migrations

# 6 cuoc thi truoc day ghi cung trong trang chu (chu ky 3) - chuyen vao CSDL de quan tri vien sua duoc.
EXISTING = [
    ("Olympic Quốc tế về Toán học", "IMO", date(2026, 5, 31), 1),
    ("Olympic Quốc tế về Lập trình", "ICO", date(2026, 5, 30), 2),
    ("Olympic Quốc tế về Khởi nghiệp & Đổi mới sáng tạo", "SCO IEIO", date(2026, 5, 30), 3),
    ("Olympic Quốc tế về Kiến thức Tài chính", "SCO IFKO", date(2026, 5, 30), 4),
    ("Olympic Quốc tế về Tiếng Anh", "SCO IEO", date(2026, 6, 7), 5),
    ("Olympic Quốc tế về Khoa học", "ISO", date(2026, 6, 7), 6),
]


def seed(apps, schema_editor):
    Competition = apps.get_model("competitions", "Competition")
    for name, code, exam_date, order in EXISTING:
        Competition.objects.get_or_create(
            code=code,
            cycle="3",
            defaults={"name": name, "exam_date": exam_date, "sort_order": order},
        )


def unseed(apps, schema_editor):
    Competition = apps.get_model("competitions", "Competition")
    Competition.objects.filter(cycle="3", code__in=[item[1] for item in EXISTING], registrations__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [("competitions", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
