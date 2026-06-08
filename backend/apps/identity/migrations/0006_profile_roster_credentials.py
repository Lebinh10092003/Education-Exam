from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0005_user_login_upper_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="candidate_number",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="profile",
            name="exam_block",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="profile",
            name="national_exam_subject",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="profile",
            name="visible_password",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="profile",
            name="ward",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
