from django.contrib import admin

from .models import Room, Section, Subject


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "units")
    search_fields = ("code", "title")


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("name", "headcount")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "capacity")
