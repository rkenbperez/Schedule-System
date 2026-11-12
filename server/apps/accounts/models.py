from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLES = [
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
    ]

    role = models.CharField(max_length=20, choices=ROLES, default='teacher')

    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username


class Teacher(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='teacher_profile',
    )
    employee_no = models.CharField(max_length=50, unique=True)
    full_name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.full_name