from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from .views import LoginView, ProfessorsViewSet

router = DefaultRouter()
router.register("profs", ProfessorsViewSet, basename="prof")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    # JWT endpoints
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
]

urlpatterns += router.urls
