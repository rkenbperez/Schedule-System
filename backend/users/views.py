from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

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


@extend_schema_view(
    list=extend_schema(tags=["users"]),
    retrieve=extend_schema(tags=["users"]),
    create=extend_schema(tags=["users"]),
    update=extend_schema(tags=["users"]),
    partial_update=extend_schema(tags=["users"]),
    destroy=extend_schema(tags=["users"]),
)
class ProfessorsViewSet(viewsets.ModelViewSet):
    queryset = Professors.objects.select_related("user").all()
    serializer_class = ProfessorsSerializer
    permission_classes = [IsRegistrarOrReadOnly]
