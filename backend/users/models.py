from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string

from catalog.models import Department, Subject, Section


class PasswordResetToken(models.Model):
    """One-time token used to reset a user's password via email link."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"reset token for {self.user.email}"

    @classmethod
    def create_for_user(cls, user, timeout_seconds=None):
        from django.conf import settings as _settings

        if timeout_seconds is None:
            timeout_seconds = getattr(_settings, "PASSWORD_RESET_TIMEOUT", 3600)
        # Invalidate any existing unused tokens for this user.
        cls.objects.filter(user=user, used=False).delete()
        token = get_random_string(48)
        return cls.objects.create(
            user=user,
            token=token,
            expires_at=timezone.now() + timezone.timedelta(seconds=timeout_seconds),
        )

    def is_valid(self):
        return not self.used and self.expires_at > timezone.now()


class Professors(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prof"
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="professors",
    )
    max_daily_hours = models.PositiveSmallIntegerField(default=8)
    max_consecutive = models.PositiveSmallIntegerField(default=4)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}"


class ProfessorPreference(models.Model):
    """Professor's preferred meeting configuration for a subject/section in a term."""

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("published", "Published"),
        ("rejected", "Rejected"),
    ]

    professor = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="preferences",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="professor_preferences",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="professor_preferences",
        null=True,
        blank=True,
    )
    term = models.ForeignKey(
        "timetable.AcademicTerm",
        on_delete=models.CASCADE,
        related_name="professor_preferences",
    )

    priority = models.PositiveSmallIntegerField(default=0)
    meetings = models.JSONField(default=list)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
        db_index=True,
    )

    submitted_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_preferences",
    )
    review_notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["professor", "subject", "section", "term"]
        # PostgreSQL treats NULLs as distinct, so unique_together does not
        # deduplicate imported rows whose section is blank. This partial
        # constraint keeps update_or_create() safe and makes re-imports
        # idempotent.
        constraints = [
            models.UniqueConstraint(
                fields=["professor", "subject", "term"],
                condition=models.Q(section__isnull=True),
                name="unique_unsectioned_professor_preference",
            ),
        ]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["term", "status"]),
            models.Index(fields=["professor", "term", "status"]),
        ]

    def __str__(self):
        section = f" ({self.section.name})" if self.section_id else ""
        return f"{self.professor} - {self.subject.code}{section} [{self.status}]"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.status == "published" and not self.published_at:
            from django.utils import timezone
            self.published_at = timezone.now()
        if self.status == "submitted" and not self.submitted_at:
            from django.utils import timezone
            self.submitted_at = timezone.now()


class PreferenceSubmission(models.Model):
    """Batch submission from department head to registrar."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
    ]

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="preference_submissions",
    )
    term = models.ForeignKey(
        "timetable.AcademicTerm",
        on_delete=models.CASCADE,
        related_name="preference_submissions",
    )
    preferences = models.ManyToManyField(
        ProfessorPreference,
        through="SubmissionItem",
        related_name="submissions",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_batches",
        null=True,
        blank=True,
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["department", "term", "status"]),
        ]

    def __str__(self):
        return f"{self.department.name} - {self.term.code} [{self.status}]"


class SubmissionItem(models.Model):
    """Through model for PreferenceSubmission <-> ProfessorPreference."""

    submission = models.ForeignKey(
        PreferenceSubmission,
        on_delete=models.CASCADE,
        related_name="items",
    )
    preference = models.ForeignKey(
        ProfessorPreference,
        on_delete=models.CASCADE,
        related_name="submission_items",
    )
    action = models.CharField(
        max_length=20,
        choices=[("publish", "Publish"), ("reject", "Reject")],
        default="publish",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = ["submission", "preference"]