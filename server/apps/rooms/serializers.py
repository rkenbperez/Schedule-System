from rest_framework import serializers

from .models import Room, RoomType


class RoomTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomType
        fields = ['id', 'name']


class RoomSerializer(serializers.ModelSerializer):
    room_type = RoomTypeSerializer(read_only=True)
    room_type_id = serializers.PrimaryKeyRelatedField(
        source='room_type',
        queryset=RoomType.objects.all(),
        write_only=True,
    )

    class Meta:
        model = Room
        fields = [
            'id',
            'room_type',
            'room_type_id',
            'code',
            'capacity',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at']