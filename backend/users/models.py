from django.conf import settings
from django.db import models

# Create your models here.
class Professors(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prof"
    )
    department = models.CharField(max_length=100, blank=True)
    max_daily_hours = models.PositiveSmallIntegerField(default=8) # Max working hours of a Professor
    max_consecutive = models.PositiveSmallIntegerField(default=4) # Maximum hours for 1 sched of a class

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}"