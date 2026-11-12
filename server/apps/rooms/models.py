from django.db import models


class RoomType(models.Model):
    ROOM_TYPE_CHOICES=[
        ('lecture','Lecture'),
        ('laboratory','Laboratory')
    ]
    
    name = models.CharField(max_length=50, unique=True,choices=ROOM_TYPE_CHOICES)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Room(models.Model):
    code = models.CharField(max_length=50, unique=True)
    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.RESTRICT,
        related_name='rooms',
    )
    capacity = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(capacity__gt=0),
                name='chk_capacity_positive',
            ),
        ]

    def __str__(self):
        return self.code