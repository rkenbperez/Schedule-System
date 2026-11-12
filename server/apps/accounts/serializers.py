from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Teacher

User = get_user_model()


class TeacherProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = ['id', 'employee_no', 'full_name', 'is_active']


class UserSerializer(serializers.ModelSerializer):
    teacher_profile = TeacherProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'teacher_profile']


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = ['id', 'employee_no', 'full_name', 'is_active']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=User.ROLES)
    employee_no = serializers.CharField(max_length=50, required=False, allow_blank=True)
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username is already taken.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email is already registered.')
        return value

    def validate(self, attrs):
        if attrs['role'] == 'teacher':
            if not attrs.get('employee_no') or not attrs.get('full_name'):
                raise serializers.ValidationError(
                    'employee_no and full_name are required for teacher accounts.'
                )
        return attrs

    def create(self, validated_data):
        role = validated_data.pop('role')
        employee_no = validated_data.pop('employee_no', None)
        full_name = validated_data.pop('full_name', None)

        user = User.objects.create_user(**validated_data, role=role)

        if role == 'teacher':
            Teacher.objects.create(
                user=user,
                employee_no=employee_no,
                full_name=full_name,
            )

        return user