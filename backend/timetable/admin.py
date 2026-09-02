from django.contrib import admin

from .models import (
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    ScheduledClass,
    ScheduleRun,
)


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("prof", "subject", "section", "meetings_per_week", "duration_slots")
    list_filter = ("prof", "section")


@admin.register(AvailabilityWindow)
class AvailabilityWindowAdmin(admin.ModelAdmin):
    list_display = ("prof", "day", "start_time", "end_time", "is_preferred")
    list_filter = ("day", "is_preferred")


@admin.register(BusyBlock)
class BusyBlockAdmin(admin.ModelAdmin):
    list_display = ("prof", "day", "start_time", "end_time")
    list_filter = ("day",)


@admin.register(ScheduleRun)
class ScheduleRunAdmin(admin.ModelAdmin):
    list_display = ("algorithm", "status", "runtime_ms", "soft_score", "created_at")
    list_filter = ("algorithm", "status")


@admin.register(ScheduledClass)
class ScheduledClassAdmin(admin.ModelAdmin):
    list_display = ("run", "assignment", "room", "day", "start_time", "duration_slots")
    list_filter = ("day", "run")
