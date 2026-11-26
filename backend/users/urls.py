from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from .views import (
    DepartmentHeadBatchPublishView,
    DepartmentHeadPublishView,
    DepartmentHeadSubmissionViewSet,
    JWTLoginView,
    JWTLogoutView,
    JWTMeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProfessorAvailabilityViewSet,
    ProfessorPreferenceSubmitView,
    ProfessorPreferenceViewSet,
    RegistrarPublishedPreferencesView,
    UserListView,
)

urlpatterns = [
    # JWT auth endpoints (primary)
    path("auth/jwt/login/", JWTLoginView.as_view(), name="jwt-login"),
    path("auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt-refresh"),
    path("auth/jwt/verify/", TokenVerifyView.as_view(), name="jwt-verify"),
    path("auth/jwt/me/", JWTMeView.as_view(), name="jwt-me"),
    path("auth/jwt/logout/", JWTLogoutView.as_view(), name="jwt-logout"),
    # Password reset
    path(
        "auth/password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "auth/password-reset/confirm/<str:token>/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    # User list (for master data forms)
    path("users/", UserListView.as_view(), name="user-list"),

    # Professor Preferences (professor self-service)
    path(
        "professor/preferences/",
        ProfessorPreferenceViewSet.as_view({"get": "list", "post": "create"}),
        name="professor-preference-list",
    ),
    path(
        "professor/preferences/<int:pk>/",
        ProfessorPreferenceViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="professor-preference-detail",
    ),
    path(
        "professor/preferences/<int:pk>/submit/",
        ProfessorPreferenceSubmitView.as_view(),
        name="professor-preference-submit",
    ),

    # Professor Availability (1-hour blocks)
    path(
        "professor/availability/",
        ProfessorAvailabilityViewSet.as_view({"get": "list", "post": "create"}),
        name="professor-availability-list",
    ),
    path(
        "professor/availability/<int:pk>/",
        ProfessorAvailabilityViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="professor-availability-detail",
    ),

    # Department Head (review/publish)
    path(
        "department-head/submissions/",
        DepartmentHeadSubmissionViewSet.as_view({"get": "list"}),
        name="department-head-submissions",
    ),
    path(
        "department-head/submissions/<int:pk>/publish/",
        DepartmentHeadPublishView.as_view(),
        name="department-head-publish",
    ),
    path(
        "department-head/submissions/batch-publish/",
        DepartmentHeadBatchPublishView.as_view(),
        name="department-head-batch-publish",
    ),

    # Registrar (published preferences + generation)
    path(
        "registrar/published-preferences/",
        RegistrarPublishedPreferencesView.as_view(),
        name="registrar-published-preferences",
    ),

    # Legacy simplejwt endpoints (kept for backward compatibility)
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
]
