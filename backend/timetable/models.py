from datetime import date, datetime, timedelta

from django.conf import settings
from django.db import models

from catalog.models import Room, Section, Subject
from users.models import Professors


WEEKDAY_CHOICES = (
    (0, "Monday"),
    (1, "Tuesday"),
    (2, "Wednesday"),
    (3, "Thursday"),
    (4, "Friday"),
    (5, "Saturday"),
)

MODE_DURATIONS = {
    "async": 1,
    "sync": 2,
    "lab": 3,
}

MODE_DURATION_SETTING_KEYS = {
    "async": "async_duration_default",
    "sync": "sync_duration_default",
    "lab": "lab_duration_default",
}


class AcademicTerm(models.Model):
    SEMESTER_CHOICES = [
        (1, "First Semester"),
        (2, "Second Semester"),
    ]
    year = models.PositiveSmallIntegerField()
    semester = models.PositiveSmallIntegerField(choices=SEMESTER_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["year", "semester"], name="unique_term"),
        ]
        ordering = ["-year", "-semester"]

    def __str__(self):
        return f"{self.get_semester_display()} {self.year}"

    @property
    def code(self):
        return f"{self.year}-{self.semester}"

    @property
    def name(self):
        return f"{self.get_semester_display()} {self.year}"


class Assignment(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.CASCADE,
        related_name="assignments",
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["prof", "subject", "section", "term"],
                name="unique_prof_subject_section_term",
            ),
        ]

    def __str__(self):
        return f"{self.prof} - {self.subject} - {self.section} ({self.term})"


class MeetingSlot(models.Model):
    class Mode(models.TextChoices):
        ASYNC = "async", "Asynchronous"
        SYNC = "sync", "Synchronous"
        LAB = "lab", "Laboratory"

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="meetings",
    )
    order = models.PositiveSmallIntegerField(default=1)
    mode = models.CharField(
        max_length=10,
        choices=Mode.choices,
        default=Mode.SYNC,
    )
    duration_slots = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "order"],
                name="unique_meeting_slot_order",
            ),
            models.CheckConstraint(
                condition=models.Q(duration_slots__gte=1),
                name="meeting_slot_duration_slots_gte_1",
            ),
        ]

    def __str__(self):
        return f"{self.assignment} #{self.order} {self.get_mode_display()} {self.duration_slots}"


class AvailabilityWindow(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="availability_windows",
    )
    day = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_preferred = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_time__lt=models.F("end_time")),
                name="availability_start_before_end",
            ),
            models.CheckConstraint(
                condition=models.Q(day__gte=0, day__lte=5),
                name="availability_day_in_range",
            ),
        ]

    def __str__(self):
        return f"{self.prof} {self.get_day_display()} {self.start_time}-{self.end_time}"


class BusyBlock(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="busy_blocks",
    )
    day = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_time__lt=models.F("end_time")),
                name="busyblock_start_before_end",
            ),
            models.CheckConstraint(
                condition=models.Q(day__gte=0, day__lte=5),
                name="busyblock_day_in_range",
            ),
        ]

    def __str__(self):
        return f"{self.prof} {self.get_day_display()} {self.start_time}-{self.end_time}"


class ScheduleRun(models.Model):
    class Status(models.TextChoices):
        FEASIBLE = "feasible", "Feasible"
        INFEASIBLE = "infeasible", "Infeasible"

    algorithm = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=Status.choices)
    runtime_ms = models.FloatField(default=0.0)
    soft_score = models.FloatField(null=True, blank=True)
    breakdown = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.CASCADE,
        related_name="schedule_runs",
        null=True,
        blank=True,
    )
    published = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.algorithm} {self.status} ({self.created_at:%Y-%m-%d %H:%M})"


class ScheduledClass(models.Model):
    run = models.ForeignKey(
        ScheduleRun,
        on_delete=models.CASCADE,
        related_name="classes",
    )
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="scheduled_classes",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_classes",
    )
    day = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    duration_slots = models.PositiveSmallIntegerField(default=1)
    mode = models.CharField(
        max_length=10,
        choices=MeetingSlot.Mode.choices,
        null=True,
        blank=True,
    )
    term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.CASCADE,
        related_name="scheduled_classes",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["day", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(duration_slots__gte=1),
                name="scheduled_class_duration_slots_gte_1",
            ),
            models.CheckConstraint(
                condition=models.Q(day__gte=0, day__lte=5),
                name="scheduled_class_day_in_range",
            ),
        ]

    def __str__(self):
        return f"{self.assignment} {self.get_day_display()} {self.start_time}"

    @property
    def end_time(self):
        end = datetime.combine(date.today(), self.start_time) + timedelta(
            hours=self.duration_slots
        )
        return end.time()


class AuditLog(models.Model):
    """Audit trail for important actions."""
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        GENERATE = "generate", "Generate Schedule"
        PUBLISH = "publish", "Publish Schedule"
        IMPORT = "import", "Import Data"
        EXPORT = "export", "Export Data"
        BULK_CREATE = "bulk_create", "Bulk Create"
        BULK_UPDATE = "bulk_update", "Bulk Update"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    model_name = models.CharField(max_length=50)
    object_id = models.CharField(max_length=100, blank=True, default="")
    object_repr = models.CharField(max_length=200, blank=True, default="")
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["action", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.user} {self.action} {self.model_name} {self.object_id} at {self.timestamp}"


class GlobalSettings(models.Model):
    """Global system settings (singleton pattern)."""
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    description = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Global Setting"
        verbose_name_plural = "Global Settings"

    def __str__(self):
        return self.key

    @classmethod
    def get(cls, key, default=None):
        """Get a setting value by key."""
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default

    @classmethod
    def set(cls, key, value, description=None, user=None):
        """Set a setting value, preserving its description when omitted."""
        defaults = {"value": value, "updated_by": user}
        if description is not None:
            defaults["description"] = description
        obj, _created = cls.objects.update_or_create(key=key, defaults=defaults)
        return obj


def is_valid_duration_setting(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 1


def get_mode_duration(mode):
    """Return the configured default duration for a meeting mode."""
    fallback = MODE_DURATIONS.get(mode, 1)
    key = MODE_DURATION_SETTING_KEYS.get(mode)
    if not key:
        return fallback
    value = GlobalSettings.get(key, fallback)
    return value if is_valid_duration_setting(value) else fallback


def get_mode_durations():
    """Return configured default durations for all meeting modes."""
    configured = dict(
        GlobalSettings.objects.filter(
            key__in=MODE_DURATION_SETTING_KEYS.values()
        ).values_list("key", "value")
    )
    durations = {}
    for mode, fallback in MODE_DURATIONS.items():
        value = configured.get(MODE_DURATION_SETTING_KEYS[mode], fallback)
        durations[mode] = value if is_valid_duration_setting(value) else fallback
    return durations


def validate_setting_value(key, value):
    """Validate a global setting value, raising ValueError when invalid."""
    if (
        key in MODE_DURATION_SETTING_KEYS.values()
        and not is_valid_duration_setting(value)
    ):
        raise ValueError(f"{key} must be a positive integer")


class ConflictResolution(models.Model):
    """Manual conflict resolution for schedule conflicts."""
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RESOLVED = "resolved", "Resolved"
        IGNORED = "ignored", "Ignored"

    class ResolutionType(models.TextChoices):
        MOVE_CLASS = "move_class", "Move Class"
        SWAP_ROOMS = "swap_rooms", "Swap Rooms"
        SWAP_TIMES = "swap_times", "Swap Times"
        CHANGE_PROFESSOR = "change_professor", "Change Professor"
        SPLIT_CLASS = "split_class", "Split Class"
        MANUAL = "manual", "Manual Resolution"

    run = models.ForeignKey(
        ScheduleRun,
        on_delete=models.CASCADE,
        related_name="conflict_resolutions",
    )
    conflict_type = models.CharField(max_length=50)
    conflict_details = models.JSONField()
    resolution_type = models.CharField(
        max_length=30,
        choices=ResolutionType.choices,
        blank=True,
        default="",
    )
    resolution_details = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.conflict_type} - {self.status} ({self.run})"
