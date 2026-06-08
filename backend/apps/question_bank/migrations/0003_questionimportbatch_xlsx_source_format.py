from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("question_bank", "0002_questionimportbatch_created_question_ids"),
    ]

    operations = [
        migrations.AlterField(
            model_name="questionimportbatch",
            name="source_format",
            field=models.CharField(
                choices=[("csv", "CSV"), ("json", "JSON"), ("xlsx", "XLSX")],
                max_length=8,
            ),
        ),
    ]
