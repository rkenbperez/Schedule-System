from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Department,
    ProfessorSubject,
    Room,
    Section,
    SectionSubject,
    Subject,
)

User = get_user_model()


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "code", "title", "units", "lec_hours", "lab_hours"]


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "name", "headcount", "program", "year_level", "term"]


class DepartmentSerializer(serializers.ModelSerializer):
    head = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
    )
    head_name = serializers.SerializerMethodField()
    head_email = serializers.EmailField(source="head.email", read_only=True, default="")

    class Meta:
        model = Department
        fields = ["id", "name", "head", "head_name", "head_email"]

    def get_head_name(self, obj):
        if not obj.head:
            return ""
        return obj.head.get_full_name() or obj.head.get_username()


class RoomSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name", read_only=True, default=""
    )
    room_type_display = serializers.CharField(
        source="get_room_type_display", read_only=True
    )

    class Meta:
        model = Room
        fields = [
            "id",
            "name",
            "capacity",
            "department",
            "department_name",
            "building",
            "room_type",
            "room_type_display",
        ]


class ProfessorSubjectSerializer(serializers.ModelSerializer):
    professor_name = serializers.SerializerMethodField()
    professor_department_id = serializers.IntegerField(
        source="professor.department_id", read_only=True
    )
    professor_department_name = serializers.CharField(
        source="professor.department.name", read_only=True, default=""
    )
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_title = serializers.CharField(source="subject.title", read_only=True)

    class Meta:
        model = ProfessorSubject
        fields = [
            "id",
            "professor",
            "professor_name",
            "professor_department_id",
            "professor_department_name",
            "subject",
            "subject_code",
            "subject_title",
            "is_preferred",
            "modality",
        ]

    def get_professor_name(self, obj):
        return str(obj.professor)


class SectionSubjectSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source="section.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_title = serializers.CharField(source="subject.title", read_only=True)

    class Meta:
        model = SectionSubject
        fields = [
            "id",
            "section",
            "section_name",
            "subject",
            "subject_code",
            "subject_title",
        ]
