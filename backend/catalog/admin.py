from django.contrib import admin

from .models import Department, Room, Section, Subject


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "units")
    search_fields = ("code", "title")


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("name", "headcount")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "capacity", "department")
    list_filter = ("department",)
