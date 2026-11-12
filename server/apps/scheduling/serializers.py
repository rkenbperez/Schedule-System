from rest_framework import serializers

from apps.academics.models import (
    AcademicTerm,
    Course,
    CourseComponent,
    Section,
)
from apps.academics.serializers import (
    AcademicTermSerializer,
    CourseComponentSerializer,
    CourseSerializer,
    SectionSerializer,
)
from apps.accounts.models import Teacher
from apps.accounts.serializers import TeacherProfileSerializer
from apps.rooms.models import Room
from apps.rooms.serializers import RoomSerializer

from .models import CourseAssignment, Schedule


class CourseAssignmentSerializer(serializers.ModelSerializer):
    academic_term = AcademicTermSerializer(read_only=True)
    teacher = TeacherProfileSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    section = SectionSerializer(read_only=True)

    class Meta:
        model = CourseAssignment
        fields = [
            'id',
            'academic_term',
            'teacher',
            'course',
            'section',
            'type',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at']


class ScheduleWriteSerializer(serializers.ModelSerializer):
    """Create/update schedules and keep denormalized FKs in sync."""

    class Meta:
        model = Schedule
        fields = [
            'id',
            'course_assignment',
            'course_component',
            'room',
            'start_time',
            'end_time',
            'day_of_week',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at', 'end_time']

    def validate(self, attrs):
        assignment = attrs.get('course_assignment')
        component = attrs.get('course_component')

        if assignment and component and component.course_id != assignment.course_id:
            raise serializers.ValidationError(
                {'course_component': 'Component must belong to the assignment\'s course.'}
            )
        return attrs

class ScheduleSerializer(serializers.ModelSerializer):
    course_assignment = CourseAssignmentSerializer(read_only=True)
    course_component = CourseComponentSerializer(read_only=True)
    academic_term = AcademicTermSerializer(read_only=True)
    teacher = TeacherProfileSerializer(read_only=True)
    section = SectionSerializer(read_only=True)
    room = RoomSerializer(read_only=True)

    class Meta:
        model = Schedule
        fields = [
            'id',
            'course_assignment',
            'course_component',
            'academic_term',
            'teacher',
            'section',
            'room',
            'start_time',
            'end_time',
            'day_of_week',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at', 'end_time']