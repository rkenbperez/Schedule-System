from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.urls import reverse

from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from core.permissions import IsRegistrarOrReadOnly

from .models import PasswordResetToken, Professors
from .serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfessorsSerializer,
)
from .throttles import LoginRateThrottle


class JWTLoginView(TokenObtainPairView):
    """Obtain JWT access + refresh tokens using email login."""

    serializer_class = LoginSerializer


class JWTLogoutView(APIView):
    """Blacklist refresh token (logout)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["auth"],
        summary="Logout - blacklist refresh token",
        request=inline_serializer(
            name="LogoutRequest",
            fields={"refresh": serializers.CharField()},
        ),
        responses={205: OpenApiResponse(description="Token blacklisted"), 400: OpenApiResponse(description="Invalid token")},
    )
    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response(
                {"detail": "Invalid or expired refresh token"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class PasswordResetRequestView(APIView):
    """Send a one-time password reset link to the user's email."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        tags=["auth"],
        summary="Request password reset link",
        request=PasswordResetRequestSerializer,
        responses={
            200: OpenApiResponse(description="Reset link sent (check console in dev)."),
            400: OpenApiResponse(description="Validation error"),
        },
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        User = get_user_model()
        user = User.objects.get(email=email)

        # Create a one-time reset token.
        reset_token = PasswordResetToken.create_for_user(user)

        # Build the reset link pointing at the frontend reset page.
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token.token}"

        send_mail(
            subject="Reset your Scheduler password",
            message=(
                f"Hello {user.username},\n\n"
                f"Click the link below to reset your password:\n{reset_url}\n\n"
                f"This link expires in 1 hour.\n"
                f"If you didn't request this, you can ignore this email.\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {"detail": "If an account exists for that email, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """Confirm a password reset using a one-time token."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["auth"],
        summary="Confirm password reset",
        request=PasswordResetConfirmSerializer,
        responses={
            200: OpenApiResponse(description="Password reset successfully."),
            400: OpenApiResponse(description="Invalid or expired token"),
        },
    )
    def post(self, request, token=None):
        data = dict(request.data)
        data["token"] = token
        serializer = PasswordResetConfirmSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Password reset successfully. You can now sign in."},
            status=status.HTTP_200_OK,
        )


class JWTMeView(APIView):
    """Current user profile + role."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["auth"],
        summary="Get current user profile",
        responses={
            200: inline_serializer(
                name="CurrentUser",
                fields={
                    "id": serializers.IntegerField(),
                    "username": serializers.CharField(),
                    "email": serializers.EmailField(),
                    "first_name": serializers.CharField(),
                    "last_name": serializers.CharField(),
                    "is_staff": serializers.BooleanField(),
                    "role": serializers.CharField(),
                    "professor": inline_serializer(
                        name="ProfessorProfile",
                        fields={
                            "id": serializers.IntegerField(),
                            "department": serializers.CharField(),
                            "max_daily_hours": serializers.IntegerField(),
                            "max_consecutive": serializers.IntegerField(),
                        },
                        required=False,
                    ),
                },
            )
        },
    )
    def get(self, request):
        user = request.user
        role = "registrar" if user.is_staff else ("professor" if hasattr(user, "prof") else "user")

        prof_data = None
        if hasattr(user, "prof"):
            prof = user.prof
            prof_data = {
                "id": prof.id,
                "department": prof.department.name if prof.department else "",
                "max_daily_hours": prof.max_daily_hours,
                "max_consecutive": prof.max_consecutive,
            }

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_staff": user.is_staff,
                "role": role,
                "professor": prof_data,
            }
        )


@extend_schema_view(
    list=extend_schema(tags=["users"]),
    retrieve=extend_schema(tags=["users"]),
    create=extend_schema(tags=["users"]),
    update=extend_schema(tags=["users"]),
    partial_update=extend_schema(tags=["users"]),
    destroy=extend_schema(tags=["users"]),
)
class ProfessorsViewSet(viewsets.ModelViewSet):
    queryset = Professors.objects.select_related("user", "department").all()
    serializer_class = ProfessorsSerializer
    permission_classes = [IsRegistrarOrReadOnly]
