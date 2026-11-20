from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import PasswordResetToken, Professors


class ProfessorsSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    department_name = serializers.CharField(
        source="department.name", read_only=True, default=""
    )

    class Meta:
        model = Professors
        fields = [
            "id",
            "user",
            "username",
            "full_name",
            "department",
            "department_name",
            "max_daily_hours",
            "max_consecutive",
        ]

    def get_full_name(self, obj):
        full_name = obj.user.get_full_name().strip()
        return full_name or obj.user.username


class LoginSerializer(TokenObtainPairSerializer):
    """Authenticate with email instead of username.

    The frontend posts { email, password }; this serializer validates
    credentials against the email field and returns JWT tokens plus the
    user payload so the client can store the current user.
    """

    username_field = "email"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Replace the default 'username' field with 'email'
        self.fields["email"] = serializers.EmailField()
        self.fields.pop("username", None)

    def validate(self, attrs):
        data = super().validate(attrs)
        role = "registrar" if self.user.is_staff else ("professor" if hasattr(self.user, "prof") else "user")
        prof_data = None
        if hasattr(self.user, "prof"):
            prof = self.user.prof
            prof_data = {
                "id": prof.id,
                "department": prof.department.name if prof.department else "",
                "max_daily_hours": prof.max_daily_hours,
                "max_consecutive": prof.max_consecutive,
            }
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "is_staff": self.user.is_staff,
            "role": role,
            "professor": prof_data,
        }
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    """Request a password reset link for the given email."""

    email = serializers.EmailField()

    def validate_email(self, value):
        User = get_user_model()
        if not User.objects.filter(email=value, is_active=True).exists():
            # Don't reveal whether the email exists.
            raise serializers.ValidationError("Invalid email or password.")
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Confirm a password reset using a one-time token."""

    token = serializers.CharField()
    new_password = serializers.CharField(
        min_length=8, style={"input_type": "password"}, write_only=True
    )

    def validate_token(self, value):
        try:
            token_obj = PasswordResetToken.objects.select_related("user").get(
                token=value
            )
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired reset token.")
        if not token_obj.is_valid():
            raise serializers.ValidationError("Invalid or expired reset token.")
        return token_obj

    def validate_new_password(self, value):
        User = get_user_model()
        # Reuse Django's password validators.
        from django.contrib.auth.password_validation import validate_password

        validate_password(value)
        return value

    def save(self):
        token_obj = self.validated_data["token"]
        user = token_obj.user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        token_obj.used = True
        token_obj.save(update_fields=["used"])
        return user
