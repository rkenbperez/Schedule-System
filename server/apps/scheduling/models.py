from django.db import models

from apps.academics.models import AcademicTerm, Course, CourseComponent, Section
from apps.accounts.models import Teacher
from apps.rooms.models import Room

class CourseAssignment(models.Model):
    """
    This teacher teaches this course to this section
    during this academic term.
    """

    COMPONENT_TYPES = [
        ('lecture', 'Lecture'),
        ('laboratory', 'Laboratory'),
    ]

    academic_term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.RESTRICT,
        related_name='course_assignments',
    )

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.RESTRICT,
        related_name='course_assignments',
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.RESTRICT,
        related_name='course_assignments',
    )

    section = models.ForeignKey(
        Section,
        on_delete=models.RESTRICT,
        related_name='course_assignments',
    )

    type = models.CharField(
        max_length=20,
        choices=COMPONENT_TYPES,
        default='lecture',
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['academic_term', 'course', 'section', 'type'],
                name='uq_course_section_per_term',
            ),
        ]
        indexes = [
            models.Index(fields=['teacher', 'academic_term']),
            models.Index(fields=['section', 'academic_term']),
        ]

    def __str__(self):
        return (
            f'{self.course.code} - '
            f'{self.section.code} '
            f'({self.academic_term.name})'
        )


class Schedule(models.Model):
    """When and where a course assignment takes place."""

    WEEKDAYS = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
    ]

    course_assignment = models.ForeignKey(
        CourseAssignment,
        on_delete=models.CASCADE,
        related_name='schedules',
    )

    course_component = models.ForeignKey(
        CourseComponent,
        on_delete=models.RESTRICT,
        related_name='schedules',
    )

    # Denormalized references from course_assignment. Kept on this table so the
    # database can enforce room/teacher/section double-booking constraints.
    academic_term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.RESTRICT,
        related_name='schedules',
    )

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.RESTRICT,
        related_name='schedules',
    )

    section = models.ForeignKey(
        Section,
        on_delete=models.RESTRICT,
        related_name='schedules',
    )

    room = models.ForeignKey(
        Room,
        on_delete=models.RESTRICT,
        related_name='schedules',
    )

    start_time = models.TimeField(
        help_text='Select start time'
    )

    end_time = models.TimeField(
        blank=True, null=True,
        help_text='Auto-calculated'
    )

    day_of_week = models.PositiveSmallIntegerField(choices=WEEKDAYS)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(day_of_week__gte=0, day_of_week__lte=4),
                name='chk_day_of_week',
            ),
            models.UniqueConstraint(
                fields=['room', 'academic_term', 'day_of_week'],
                name='uq_room_slot',
            ),
            models.UniqueConstraint(
                fields=['teacher', 'academic_term', 'day_of_week'],
                name='uq_teacher_slot',
            ),
            models.UniqueConstraint(
                fields=['section', 'academic_term', 'day_of_week'],
                name='uq_section_slot',
            ),
            models.UniqueConstraint(
                fields=['course_assignment', 'course_component', 'day_of_week'],
                name='uq_component_slot',
            ),
        ]
        indexes = [
            models.Index(fields=['section', 'academic_term']),
            models.Index(fields=['room', 'academic_term']),
        ]

    def __str__(self):
        return (
            f'{self.course_assignment.course.code} - '
            f'{self.course_component.label} - '
            f'{self.room.code}'
        )