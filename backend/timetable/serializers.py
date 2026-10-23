from rest_framework import serializers

from .models import (
    AcademicTerm,
    Assignment,
    AuditLog,
    AvailabilityWindow,
    BusyBlock,
    ConflictResolution,
    GlobalSettings,
    MeetingSlot,
    ScheduledClass,
    ScheduleRun,
    get_mode_duration,
)

from django.db import transaction


class MeetingSlotSerializer(serializers.ModelSerializer):
    mode = serializers.ChoiceField(
        choices=MeetingSlot.Mode.choices,
        required=False,
        default=MeetingSlot.Mode.SYNC,
    )
    mode_display = serializers.CharField(source="get_mode_display", read_only=True)
    duration_slots = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = MeetingSlot
        fields = ["id", "order", "mode", "mode_display", "duration_slots"]
        read_only_fields = ["order"]

    def validate(self, attrs):
        if "duration_slots" not in attrs:
            mode = attrs.get("mode", MeetingSlot.Mode.SYNC)
            attrs["duration_slots"] = get_mode_duration(mode)
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
            "term",
            "meetings",
            "prof_name",
            "subject_label",
            "section_name",
        ]
        read_only_fields = ["term"]

    def get_prof_name(self, obj):
        return str(obj.prof)

    def get_subject_label(self, obj):
        return str(obj.subject)

    def get_section_name(self, obj):
        return obj.section.name

    def _replace_meetings(self, assignment, meetings):
        assignment.meetings.all().delete()
        for order, data in enumerate(meetings, start=1):
            mode = data.get("mode", MeetingSlot.Mode.SYNC)
            MeetingSlot.objects.create(
                assignment=assignment,
                order=order,
                mode=mode,
                duration_slots=data.get(
                    "duration_slots",
                    get_mode_duration(mode),
                ),
            )

    def _has_synchronous_meeting(self, meetings):
        return any(
            m.get("mode", MeetingSlot.Mode.SYNC) in (MeetingSlot.Mode.SYNC, MeetingSlot.Mode.LAB)
            for m in meetings
        )

    def _raise_requires_synchronous(self):
        raise serializers.ValidationError(
            {
                "meetings": (
                    "A subject must have at least one synchronous "
                    "(sync or lab) meeting per week; the load cannot "
                    "be all asynchronous."
                )
            }
        )

    def validate(self, attrs):
        meetings = attrs.get("meetings")
        if meetings is not None:
            if not meetings:
                raise serializers.ValidationError(
                    {"meetings": "An assignment must have at least one meeting."}
                )
            if not self._has_synchronous_meeting(meetings):
                self._raise_requires_synchronous()
        elif self.instance is not None:
            existing = list(self.instance.meetings.all())
            if not existing:
                raise serializers.ValidationError(
                    {"meetings": "An assignment must have at least one meeting."}
                )
            if not any(
                m.mode in (MeetingSlot.Mode.SYNC, MeetingSlot.Mode.LAB)
                for m in existing
            ):
                self._raise_requires_synchronous()
        return attrs

    def create(self, validated_data):
        meetings = validated_data.pop("meetings", [])
        section = validated_data.get("section")
        if section and not validated_data.get("term"):
            validated_data["term"] = section.term
        with transaction.atomic():
            assignment = Assignment.objects.create(**validated_data)
            self._replace_meetings(assignment, meetings)
        return assignment

    def update(self, instance, validated_data):
        meetings = validated_data.pop("meetings", None)
        with transaction.atomic():
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

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError(
                {"end_time": "End time must be later than start time."}
            )
        return attrs


class BusyBlockSerializer(serializers.ModelSerializer):
    day_display = serializers.CharField(source="get_day_display", read_only=True)

    class Meta:
        model = BusyBlock
        fields = ["id", "prof", "day", "day_display", "start_time", "end_time"]

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError(
                {"end_time": "End time must be later than start time."}
            )
        return attrs


class ScheduleRunSerializer(serializers.ModelSerializer):
    class_count = serializers.SerializerMethodField()
    spread = serializers.SerializerMethodField()
    consecutive = serializers.SerializerMethodField()
    preferred = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleRun
        fields = [
            "id",
            "algorithm",
            "status",
            "runtime_ms",
            "soft_score",
            "spread",
            "consecutive",
            "preferred",
            "created_by",
            "created_at",
            "term",
            "published",
            "class_count",
        ]

    def get_class_count(self, obj):
        return obj.classes.count()

    def get_spread(self, obj):
        return (getattr(obj, "breakdown", None) or {}).get("spread", 0.0)

    def get_consecutive(self, obj):
        return (getattr(obj, "breakdown", None) or {}).get("consecutive", 0.0)

    def get_preferred(self, obj):
        return (getattr(obj, "breakdown", None) or {}).get("preferred", 0.0)


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
            "term",
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


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "action",
            "model_name",
            "object_id",
            "object_repr",
            "changes",
            "ip_address",
            "user_agent",
            "timestamp",
        ]
        read_only_fields = fields

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return "System"


class GlobalSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalSettings
        fields = ["id", "key", "value", "description", "updated_at", "updated_by"]
        read_only_fields = ["key", "updated_at", "updated_by"]


class ConflictResolutionSerializer(serializers.ModelSerializer):
    run_id = serializers.IntegerField(source="run.id", read_only=True)
    run_algorithm = serializers.CharField(source="run.algorithm", read_only=True)
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ConflictResolution
        fields = [
            "id",
            "run",
            "run_id",
            "run_algorithm",
            "conflict_type",
            "conflict_details",
            "resolution_type",
            "resolution_details",
            "status",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = ["run", "created_at", "resolved_by", "resolved_at"]

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            return obj.resolved_by.get_full_name() or obj.resolved_by.username
        return None


class ConflictResolutionResolveSerializer(serializers.Serializer):
    resolution_type = serializers.ChoiceField(choices=ConflictResolution.ResolutionType.choices)
    resolution_details = serializers.JSONField(required=False, default=dict)
