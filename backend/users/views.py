from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from core.permissions import IsRegistrarOrReadOnly

from .models import Professors
from .serializers import LoginSerializer, ProfessorsSerializer
from .throttles import LoginRateThrottle


@extend_schema(
    tags=["auth"],
    request=LoginSerializer,
    responses={
        200: OpenApiResponse(description="Login successful, returns an auth token"),
    },
)
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "is_staff": user.is_staff,
                },
            },
            status=status.HTTP_200_OK,
        )


class JWTLoginView(TokenObtainPairView):
    """Obtain JWT access + refresh tokens."""

    @extend_schema(
        tags=["auth"],
        summary="Obtain JWT token pair",
        description="Returns access + refresh tokens. Use access token as 'Bearer <token>' in Authorization header.",
        responses={
            200: inline_serializer(
                name="JWTTokenPair",
                fields={
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                },
            ),
            401: OpenApiResponse(description="Invalid credentials"),
        },
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


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
