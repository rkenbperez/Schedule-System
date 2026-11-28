from django.conf import settings
from django.db import models


class ImportBatch(models.Model):
    """Audit record for a committed import, used to roll it back."""

    class Status(models.TextChoices):
        COMMITTED = "committed", "Committed"
        ROLLED_BACK = "rolled_back", "Rolled back"

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    filename = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.COMMITTED
    )
    summary = models.JSONField(default=dict, blank=True)
    # {"created": [{"model", "pk"}], "updated": [{"model", "pk", "before"}]}
    manifest = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Import {self.pk} ({self.filename or 'unnamed'}) [{self.status}]"
