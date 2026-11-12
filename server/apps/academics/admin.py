from django.contrib import admin

from .models import AcademicTerm, Course, CourseComponent, Section


@admin.register(AcademicTerm)
class AcademicTermAdmin(admin.ModelAdmin):
    list_display = ('name', 'school_year', 'term_type', 'start_date', 'end_date', 'is_active')
    list_filter = ('term_type', 'is_active')
    search_fields = ('name', 'school_year')


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'units', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('code', 'title')


@admin.register(CourseComponent)
class CourseComponentAdmin(admin.ModelAdmin):
    list_display = ('id', 'course', 'label', 'room_type', 'is_active')
    list_filter = ('label', 'is_active', 'room_type')
    search_fields = ('course__code', 'course__title')


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('code', 'program', 'year_level', 'student_count', 'academic_term', 'is_active')
    list_filter = ('academic_term', 'program', 'is_active')
    search_fields = ('code', 'program')