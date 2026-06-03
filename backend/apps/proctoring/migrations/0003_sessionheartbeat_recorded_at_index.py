from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("proctoring", "0002_proctorevidence_deleted_at_and_more"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="sessionheartbeat",
            index=models.Index(fields=["-recorded_at"], name="sh_recorded_at_idx"),
        ),
    ]
