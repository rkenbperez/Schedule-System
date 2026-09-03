from rest_framework import serializers

from .models import (
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    ScheduledClass,
    ScheduleRun,
)


class AssignmentSerializer(serializers.ModelSerializer):
    prof_name = serializers.SerializerMethodField()
    subject_label = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            "id",
            "prof",
            "subject",
            "section",
            "meetings_per_week",
            "duration_slots",
            "prof_name",
            "subject_label",
            "section_name",
        ]

    def get_prof_name(self, obj):
        return str(obj.prof)

    def get_subject_label(self, obj):
        return str(obj.subject)

    def get_section_name(self, obj):
        return obj.section.name


class AvailabilityWindowSerializer(serializers.ModelSerializer):
    day_display = serializers.CharField(source="get_day_display", read_only=True)

    class Meta:
        model = AvailabilityWindow
        fields = [
            "id",
            "prof",
            "day",
            "day_display",
            "start_time",
            "end_time",
            "is_preferred",
        ]


class BusyBlockSerializer(serializers.ModelSerializer):
    day_display = serializers.CharField(source="get_day_display", read_only=True)

    class Meta:
        model = BusyBlock
        fields = ["id", "prof", "day", "day_display", "start_time", "end_time"]


class ScheduleRunSerializer(serializers.ModelSerializer):
    class_count = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleRun
        fields = [
            "id",
            "algorithm",
            "status",
            "runtime_ms",
            "soft_score",
            "created_by",
            "created_at",
            "class_count",
        ]

    def get_class_count(self, obj):
        return obj.classes.count()


class ScheduledClassSerializer(serializers.ModelSerializer):
    day_display = serializers.CharField(source="get_day_display", read_only=True)
    assignment_label = serializers.SerializerMethodField()
    prof_id = serializers.IntegerField(source="assignment.prof_id", read_only=True)
    prof_name = serializers.SerializerMethodField()
    section_id = serializers.IntegerField(source="assignment.section_id", read_only=True)
    section_name = serializers.SerializerMethodField()
    subject_label = serializers.SerializerMethodField()
    room_name = serializers.SerializerMethodField()
    end_time = serializers.TimeField(read_only=True)

    class Meta:
        model = ScheduledClass
        fields = [
            "id",
            "run",
            "assignment",
            "assignment_label",
            "prof_id",
            "prof_name",
            "section_id",
            "section_name",
            "subject_label",
            "room",
            "room_name",
            "day",
            "day_display",
            "start_time",
            "end_time",
            "duration_slots",
        ]

    def get_assignment_label(self, obj):
        return str(obj.assignment)

    def get_prof_name(self, obj):
        return str(obj.assignment.prof)

    def get_section_name(self, obj):
        return obj.assignment.section.name

    def get_subject_label(self, obj):
        return str(obj.assignment.subject)

    def get_room_name(self, obj):
        return obj.room.name if obj.room else None
