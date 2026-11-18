from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string

from catalog.models import Department


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
    max_daily_hours = models.PositiveSmallIntegerField(default=8) # Max working hours of a Professor
    max_consecutive = models.PositiveSmallIntegerField(default=4) # Maximum hours for 1 sched of a class

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}"