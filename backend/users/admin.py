from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

from .models import Professors


class ProfessorsInline(admin.StackedInline):
    model = Professors
    can_delete = False
    verbose_name_plural = "professors"


admin.site.unregister(User)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    inlines = [ProfessorsInline]
