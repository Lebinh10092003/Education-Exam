from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("exam_delivery", "0002_exam_session_pause_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="submission",
            name="source",
            field=models.CharField(
                choices=[
                    ("manual", "Manual"),
                    ("auto_timeout", "Auto Timeout"),
                    ("forced_close", "Forced Close"),
                ],
                default="manual",
                max_length=16,
            ),
        ),
    ]
