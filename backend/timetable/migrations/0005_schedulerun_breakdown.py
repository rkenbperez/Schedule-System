from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("timetable", "0004_meetingslot_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="schedulerun",
            name="breakdown",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
