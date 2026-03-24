from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("exam_authoring", "0003_exam_mode"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="exam",
            name="period",
        ),
        migrations.RemoveField(
            model_name="exam",
            name="room",
        ),
        migrations.DeleteModel(
            name="ExamPeriod",
        ),
        migrations.DeleteModel(
            name="ExamRoom",
        ),
    ]
