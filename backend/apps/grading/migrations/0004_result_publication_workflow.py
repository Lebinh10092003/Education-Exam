from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("grading", "0003_manual_grading_suggestions"),
    ]

    operations = [
        migrations.AlterField(
            model_name="result",
            name="publish_state",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("reviewing", "Reviewing"),
                    ("locked", "Locked"),
                    ("scheduled", "Scheduled"),
                    ("published", "Published"),
                ],
                default="draft",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="result",
            name="locked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="result",
            name="locked_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="locked_results",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="result",
            name="scheduled_publish_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="result",
            name="publication_note",
            field=models.TextField(blank=True),
        ),
    ]
