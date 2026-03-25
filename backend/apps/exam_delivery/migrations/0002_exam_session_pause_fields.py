from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("exam_delivery", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="examsession",
            name="paused_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="examsession",
            name="remaining_seconds_at_pause",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
