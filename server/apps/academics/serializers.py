from rest_framework import serializers

from apps.rooms.models import RoomType
from apps.rooms.serializers import RoomTypeSerializer

from .models import AcademicTerm, Course, CourseComponent, Section


class AcademicTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicTerm
        fields = [
            'id',
            'name',
            'school_year',
            'term_type',
            'start_date',
            'end_date',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at']


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'code', 'title', 'units', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class CourseComponentSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    room_type = RoomTypeSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        source='course',
        queryset=Course.objects.all(),
        write_only=True,
    )
    room_type_id = serializers.PrimaryKeyRelatedField(
        source='room_type',
        queryset=RoomType.objects.all(),
        write_only=True,
    )

    class Meta:
        model = CourseComponent
        fields = [
            'id',
            'course',
            'course_id',
            'room_type',
            'room_type_id',
            'label',
            'duration',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at']


class SectionSerializer(serializers.ModelSerializer):
    academic_term = AcademicTermSerializer(read_only=True)
    academic_term_id = serializers.PrimaryKeyRelatedField(
        source='academic_term',
        queryset=AcademicTerm.objects.all(),
        write_only=True,
    )

    class Meta:
        model = Section
        fields = [
            'id',
            'code',
            'program',
            'year_level',
            'student_count',
            'academic_term',
            'academic_term_id',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at']