from django.contrib import admin

from .models import (
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    MeetingSlot,
    ScheduledClass,
    ScheduleRun,
)


class MeetingSlotInline(admin.TabularInline):
    model = MeetingSlot
    extra = 0


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("prof", "subject", "section", "meeting_count")
    list_filter = ("prof", "section")
    inlines = [MeetingSlotInline]

    @admin.display(description="Meetings")
    def meeting_count(self, obj):
        return obj.meetings.count()


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
    list_display = ("run", "assignment", "room", "day", "start_time", "duration_slots", "mode")
    list_filter = ("day", "run")
