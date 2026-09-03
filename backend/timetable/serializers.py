from rest_framework import serializers

from .models import (
    MODE_DURATIONS,
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    MeetingSlot,
    ScheduledClass,
    ScheduleRun,
)


class MeetingSlotSerializer(serializers.ModelSerializer):
    mode = serializers.ChoiceField(
        choices=MeetingSlot.Mode.choices,
        required=False,
        default=MeetingSlot.Mode.SYNC,
    )
    mode_display = serializers.CharField(source="get_mode_display", read_only=True)

    class Meta:
        model = MeetingSlot
        fields = ["id", "order", "mode", "mode_display", "duration_slots"]
        read_only_fields = ["order"]

    def validate(self, attrs):
        if "duration_slots" not in attrs:
            mode = attrs.get("mode", MeetingSlot.Mode.SYNC)
            attrs["duration_slots"] = MODE_DURATIONS.get(mode, 1)
        return attrs


class AssignmentSerializer(serializers.ModelSerializer):
    prof_name = serializers.SerializerMethodField()
    subject_label = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    meetings = MeetingSlotSerializer(many=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "prof",
            "subject",
            "section",
            "meetings",
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

    def _replace_meetings(self, assignment, meetings):
        assignment.meetings.all().delete()
        for order, data in enumerate(meetings, start=1):
            MeetingSlot.objects.create(
                assignment=assignment,
                order=order,
                mode=data.get("mode", MeetingSlot.Mode.SYNC),
                duration_slots=data.get(
                    "duration_slots",
                    MODE_DURATIONS.get(data.get("mode"), 1),
                ),
            )

    def create(self, validated_data):
        meetings = validated_data.pop("meetings", [])
        assignment = Assignment.objects.create(**validated_data)
        self._replace_meetings(assignment, meetings)
        return assignment

    def update(self, instance, validated_data):
        meetings = validated_data.pop("meetings", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if meetings is not None:
            self._replace_meetings(instance, meetings)
        return instance


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
    mode_display = serializers.CharField(source="get_mode_display", read_only=True)

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
            "mode",
            "mode_display",
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
