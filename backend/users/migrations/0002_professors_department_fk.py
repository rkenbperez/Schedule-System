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


def restore_department_text(apps, schema_editor):
    Professors = apps.get_model("users", "Professors")
    for prof in Professors.objects.select_related("department").all():
        if prof.department_id is None:
            continue
        prof.department_text = prof.department.name
        prof.save(update_fields=["department_text"])


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
        migrations.RunPython(migrate_departments, restore_department_text),
        migrations.RemoveField(
            model_name="professors",
            name="department_text",
        ),
    ]
