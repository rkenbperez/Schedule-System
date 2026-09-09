from django.db import migrations, models
import django.db.models.deletion


def migrate_departments(apps, schema_editor):
    Department = apps.get_model("catalog", "Department")
    Professors = apps.get_model("users", "Professors")
    for prof in Professors.objects.all():
        raw = prof.department_text
        if not raw:
            continue
        dept, _ = Department.objects.get_or_create(name=raw)
        prof.department = dept
        prof.save(update_fields=["department"])


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_department_room_department"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="professors",
            old_name="department",
            new_name="department_text",
        ),
        migrations.AddField(
            model_name="professors",
            name="department",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="professors",
                to="catalog.department",
            ),
        ),
        migrations.RunPython(migrate_departments, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="professors",
            name="department_text",
        ),
    ]
