import re

from django.db import migrations


def backfill_program(apps, schema_editor):
    Section = apps.get_model("catalog", "Section")
    for section in Section.objects.filter(program=""):
        match = re.match(r"^([A-Za-z]+)", section.name or "")
        if match:
            section.program = match.group(1)
            section.save(update_fields=["program"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_section_term_section_year_level"),
    ]

    operations = [
        migrations.RunPython(backfill_program, migrations.RunPython.noop),
    ]
