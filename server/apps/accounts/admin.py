from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Teacher, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ('username', 'email', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = DjangoUserAdmin.fieldsets + (('Role', {'fields': ('role',)}),)
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (('Role', {'fields': ('role',)}),)


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('employee_no', 'full_name', 'is_active', 'user')
    list_filter = ('is_active',)
    search_fields = ('employee_no', 'full_name')