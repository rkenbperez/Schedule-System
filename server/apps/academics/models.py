from random import choice, choices
from unittest.util import _MAX_LENGTH

from django.db import models


class AcademicTerm(models.Model):
    name = models.CharField(max_length=100)
    school_year = models.CharField(max_length=20)

    term_type = models.CharField(
        max_length=20,
        default='regular',
    )

    start_date = models.DateField()
    end_date = models.DateField()

    is_active = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gt=models.F('start_date')),
                name='chk_term_dates',
            ),
            models.UniqueConstraint(
                fields=['school_year', 'name'],
                name='uq_term',
            ),
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='uq_one_active_term',
            ),
        ]

    def __str__(self):
        return f'{self.school_year} - {self.name}'


class Course(models.Model):
    code = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=225)
    units = models.DecimalField(max_digits=3, decimal_places=1, default=3.0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.title}'


class CourseComponent(models.Model):
    COURSE_COMPONENT_CHOICES = [
        ('lecture', 'Lecture'),
        ('laboratory', 'Laboratory'),
    ]
    
    COURSE_COMPONENT_DURATION = [
        (2, 'Lecture'),
        (4, 'Laboratory'),
    ]

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='components',
    )

    room_type = models.ForeignKey(
        'rooms.RoomType',
        on_delete=models.RESTRICT,
        related_name='components',
    )

    label = models.CharField(
        max_length=20,
        choices=COURSE_COMPONENT_CHOICES,
    )
    
    duration = models.PositiveSmallIntegerField(
        max_length=10,
        choices=COURSE_COMPONENT_DURATION
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'label'],
                name='uq_course_component_label',
            ),
        ]

    def __str__(self):
        return f'{self.course.code} - {self.label}'


class Section(models.Model):
    code = models.CharField(max_length=20)

    program = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )

    year_level = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
    )

    student_count = models.PositiveIntegerField(default=0)

    academic_term = models.ForeignKey(
        AcademicTerm,
        on_delete=models.RESTRICT,
        related_name='sections',
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['academic_term', 'code']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(student_count__gte=0),
                name='chk_student_count_non_negative',
            ),
            models.UniqueConstraint(
                fields=['academic_term', 'code'],
                name='uq_section_per_term',
            ),
        ]

    def __str__(self):
        return self.code