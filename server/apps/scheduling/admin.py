from django.contrib import admin

from .models import CourseAssignment, Schedule


@admin.register(CourseAssignment)
class CourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'academic_term', 'course', 'section', 'teacher', 'is_active')
    list_filter = ('academic_term', 'is_active')
    search_fields = ('course__code', 'course__title', 'section__code', 'teacher__full_name')


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'course_assignment',
        'course_component',
        'room',
        'start_time',
        'end_time',
        'day_of_week',
        'is_active',
    )
    list_filter = ('academic_term', 'day_of_week', 'is_active')
    search_fields = (
        'course_assignment__course__code',
        'course_assignment__course__title',
        'section__code',
        'room__code',
    )