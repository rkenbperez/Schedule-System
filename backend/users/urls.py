from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from .views import JWTLoginView, JWTLogoutView, JWTMeView, LoginView

urlpatterns = [
    # Legacy DRF token auth (deprecated, kept for compatibility)
    path("auth/login/", LoginView.as_view(), name="login"),
    # JWT auth endpoints (new)
    path("auth/jwt/login/", JWTLoginView.as_view(), name="jwt-login"),
    path("auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt-refresh"),
    path("auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt-verify"),
    path("auth/jwt/me/", JWTMeView.as_view(), name="jwt-me"),
    path("auth/jwt/logout/", JWTLogoutView.as_view(), name="jwt-logout"),
    # Legacy simplejwt endpoints (kept for backward compatibility)
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
]
