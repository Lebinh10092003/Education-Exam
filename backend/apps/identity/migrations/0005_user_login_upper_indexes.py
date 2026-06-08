import django.db.models.functions.text
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0004_candidate_notification_permissions"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="user",
            index=models.Index(
                django.db.models.functions.text.Upper("username"),
                name="ident_user_un_upper_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(
                django.db.models.functions.text.Upper("email"),
                name="ident_user_em_upper_idx",
            ),
        ),
    ]
