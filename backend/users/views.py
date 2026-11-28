from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.urls import reverse

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from core.permissions import IsRegistrarOrReadOnly

from .models import (
    PasswordResetToken,
    Professors,
    ProfessorPreference,
    PreferenceSubmission,
    SubmissionItem,
)
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfessorsSerializer,
    ProfessorPreferenceSerializer,
    ProfessorPreferenceListSerializer,
    PreferenceSubmissionSerializer,
)
from .permissions import IsProfessor, IsDepartmentHead, IsRegistrar
from .throttles import LoginRateThrottle

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


class UserListView(APIView):
    """Read-only list of users for use in professor creation dropdowns."""
    permission_classes = [IsRegistrarOrReadOnly]

    def get(self, request):
        users = User.objects.all().order_by("username")
        return Response(UserSerializer(users, many=True).data)


class JWTLoginView(TokenObtainPairView):
    """Obtain JWT access + refresh tokens using email login."""

    serializer_class = LoginSerializer
    throttle_classes = [LoginRateThrottle]


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


class ChangePasswordView(APIView):
    """Change the password of the signed-in user."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["auth"],
        summary="Change password",
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password updated successfully."),
            400: OpenApiResponse(description="Validation error"),
        },
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Password updated successfully."},
            status=status.HTTP_200_OK,
        )


class ProfessorSetupLinkView(APIView):
    """Generate a 24-hour password setup link for an existing professor."""

    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["users"],
        summary="Create a professor account setup link",
        request=None,
        responses={
            200: OpenApiResponse(description="Setup link generated."),
            400: OpenApiResponse(description="Professor account is inactive"),
            404: OpenApiResponse(description="Professor not found"),
        },
    )
    def post(self, request, pk):
        professor = get_object_or_404(Professors, pk=pk)
        if not professor.user.is_active:
            return Response(
                {"detail": "Cannot create a setup link for an inactive account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_obj = PasswordResetToken.create_for_user(
            professor.user, timeout_seconds=86400
        )
        setup_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/reset-password"
            f"?token={token_obj.token}"
        )
        return Response(
            {"setup_url": setup_url, "expires_at": token_obj.expires_at},
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
                    "department": inline_serializer(
                        name="HeadedDepartment",
                        fields={
                            "id": serializers.IntegerField(),
                            "name": serializers.CharField(),
                        },
                        required=False,
                    ),
                },
            )
        },
    )
    def get(self, request):
        from .services import user_role_and_department

        user = request.user
        role, dept_data = user_role_and_department(user)

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
                "department": dept_data,
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
    serializer_class = ProfessorsSerializer
    permission_classes = [IsRegistrarOrReadOnly]

    def get_queryset(self):
        qs = Professors.objects.select_related("user", "department").all()
        params = self.request.query_params
        department_id = params.get("department")
        if department_id:
            try:
                department_id = int(department_id)
            except (TypeError, ValueError):
                # Malformed value behaves as absent so the default active-term
                # scoping below still applies.
                department_id = None
        if department_id is not None:
            # Department-scoped lists (e.g. department head assignment UI)
            # must see every professor of the department, including ones
            # without assignments in the active term, so the default
            # active-term filter below is skipped when this param is used.
            qs = qs.filter(department_id=department_id)
        term_id = params.get("term")
        if term_id:
            try:
                qs = qs.filter(assignments__term_id=int(term_id)).distinct()
            except (TypeError, ValueError):
                pass
        elif not department_id:
            from timetable.models import AcademicTerm
            active_term = AcademicTerm.objects.filter(is_active=True).first()
            if active_term is not None:
                qs = qs.filter(assignments__term=active_term).distinct()
        return qs


@extend_schema_view(
    list=extend_schema(tags=["professor-preferences"], summary="List my preferences"),
    create=extend_schema(tags=["professor-preferences"], summary="Create preference"),
    retrieve=extend_schema(tags=["professor-preferences"], summary="Get preference"),
    update=extend_schema(tags=["professor-preferences"], summary="Update preference"),
    partial_update=extend_schema(tags=["professor-preferences"], summary="Partial update preference"),
    destroy=extend_schema(tags=["professor-preferences"], summary="Delete preference"),
)
class ProfessorPreferenceViewSet(viewsets.ModelViewSet):
    """Professor's course preferences for active term."""

    serializer_class = ProfessorPreferenceSerializer
    permission_classes = [IsProfessor]

    def get_queryset(self):
        from timetable.models import AcademicTerm
        user = self.request.user
        if not hasattr(user, "prof"):
            return ProfessorPreference.objects.none()

        active_term = AcademicTerm.objects.filter(is_active=True).first()
        if not active_term:
            return ProfessorPreference.objects.none()

        return ProfessorPreference.objects.filter(
            professor=user.prof,
            term=active_term,
        ).select_related("professor__user", "subject", "section", "term", "professor__department")

    def get_serializer_class(self):
        if self.action == "list":
            return ProfessorPreferenceListSerializer
        return ProfessorPreferenceSerializer

    def perform_create(self, serializer):
        from timetable.models import AcademicTerm
        active_term = AcademicTerm.objects.filter(is_active=True).first()
        if not active_term:
            raise serializers.ValidationError("No active term found.")
        serializer.save(professor=self.request.user.prof, term=active_term)


@extend_schema_view(
    list=extend_schema(tags=["professor-preferences"], summary="Submit preference for review"),
)
class ProfessorPreferenceSubmitView(APIView):
    """Submit a preference for department head review."""

    permission_classes = [IsProfessor]

    @extend_schema(
        tags=["professor-preferences"],
        summary="Submit preference for review",
        request=inline_serializer(
            name="SubmitPreferenceRequest",
            fields={},
        ),
        responses={
            200: ProfessorPreferenceSerializer,
            400: OpenApiResponse(description="Invalid state"),
        },
    )
    def post(self, request, pk=None):
        try:
            pref = ProfessorPreference.objects.get(pk=pk, professor=request.user.prof)
        except ProfessorPreference.DoesNotExist:
            return Response(
                {"detail": "Preference not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if pref.status not in ("draft", "rejected"):
            return Response(
                {"detail": f"Cannot submit preference with status '{pref.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        pref.status = "submitted"
        pref.submitted_at = timezone.now()
        # Clear stale rejection state from a previous review round.
        pref.reviewed_by = None
        pref.review_notes = ""
        pref.save(
            update_fields=[
                "status",
                "submitted_at",
                "reviewed_by",
                "review_notes",
                "updated_at",
            ]
        )

        # Surface the preference on the department head's review queue.
        # Idempotent upsert: resubmissions reuse the same submission/item
        # instead of creating duplicates.
        if pref.professor.department_id:
            submission, _ = PreferenceSubmission.objects.get_or_create(
                department=pref.professor.department,
                term=pref.term,
                defaults={"submitted_by": request.user},
            )
            SubmissionItem.objects.update_or_create(
                submission=submission,
                preference=pref,
                defaults={"action": "publish", "notes": ""},
            )

        serializer = ProfessorPreferenceSerializer(pref, context={"request": request})
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(tags=["professor-availability"], summary="List my availability windows"),
    create=extend_schema(tags=["professor-availability"], summary="Create availability window"),
    retrieve=extend_schema(tags=["professor-availability"], summary="Get availability window"),
    update=extend_schema(tags=["professor-availability"], summary="Update availability window"),
    partial_update=extend_schema(tags=["professor-availability"], summary="Partial update availability window"),
    destroy=extend_schema(tags=["professor-availability"], summary="Delete availability window"),
)
class ProfessorAvailabilityViewSet(viewsets.ModelViewSet):
    """Professor's availability windows (1-hour blocks)."""

    permission_classes = [IsProfessor]

    def get_queryset(self):
        from timetable.models import AcademicTerm, AvailabilityWindow
        user = self.request.user
        if not hasattr(user, "prof"):
            return AvailabilityWindow.objects.none()

        active_term = AcademicTerm.objects.filter(is_active=True).first()
        if not active_term:
            return AvailabilityWindow.objects.none()

        return AvailabilityWindow.objects.filter(
            prof=user.prof,
            term=active_term,
        ).select_related("prof")

    def get_serializer_class(self):
        from timetable.serializers import AvailabilityWindowSerializer
        return AvailabilityWindowSerializer

    def perform_create(self, serializer):
        from timetable.models import AcademicTerm
        active_term = AcademicTerm.objects.filter(is_active=True).first()
        if not active_term:
            raise serializers.ValidationError("No active term found.")
        serializer.save(prof=self.request.user.prof, term=active_term)


@extend_schema_view(
    list=extend_schema(tags=["department-head"], summary="List pending submissions for my department"),
)
class DepartmentHeadSubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Department head views pending professor submissions."""

    serializer_class = PreferenceSubmissionSerializer
    permission_classes = [IsDepartmentHead]

    def get_queryset(self):
        from catalog.models import Department
        user = self.request.user
        dept = Department.objects.filter(head=user).first()
        if not dept:
            return PreferenceSubmission.objects.none()

        from timetable.models import AcademicTerm
        active_term = AcademicTerm.objects.filter(is_active=True).first()
        if not active_term:
            return PreferenceSubmission.objects.none()

        return PreferenceSubmission.objects.filter(
            department=dept,
            term=active_term,
        ).prefetch_related(
            "items__preference__professor__user",
            "items__preference__subject",
            "items__preference__section",
            "submitted_by",
        ).order_by("-submitted_at")


@extend_schema_view(
    create=extend_schema(tags=["department-head"], summary="Publish individual preference"),
)
class DepartmentHeadPublishView(APIView):
    """Publish or reject individual professor preference."""

    permission_classes = [IsDepartmentHead]

    @extend_schema(
        tags=["department-head"],
        summary="Publish preference",
        request=inline_serializer(
            name="PublishPreferenceRequest",
            fields={
                "action": serializers.ChoiceField(choices=["publish", "reject"]),
                "notes": serializers.CharField(required=False, allow_blank=True),
            },
        ),
        responses={
            200: ProfessorPreferenceSerializer,
            400: OpenApiResponse(description="Invalid state"),
            404: OpenApiResponse(description="Not found"),
        },
    )
    def post(self, request, pk=None):
        from catalog.models import Department
        user = request.user
        dept = Department.objects.filter(head=user).first()
        if not dept:
            return Response(
                {"detail": "You are not a department head."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            pref = ProfessorPreference.objects.select_related("professor__department").get(
                pk=pk,
                professor__department=dept,
            )
        except ProfessorPreference.DoesNotExist:
            return Response(
                {"detail": "Preference not found in your department."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if pref.status not in ["draft", "submitted"]:
            return Response(
                {"detail": f"Cannot process preference with status '{pref.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action = request.data.get("action", "publish")
        notes = request.data.get("notes", "")

        from django.utils import timezone
        if action == "publish":
            pref.status = "published"
            pref.published_at = timezone.now()
        else:
            pref.status = "rejected"
        pref.reviewed_by = user
        pref.review_notes = notes
        pref.save(update_fields=["status", "published_at", "reviewed_by", "review_notes", "updated_at"])
        pref.submission_items.update(
            action="publish" if action == "publish" else "reject",
            notes=notes,
        )

        serializer = ProfessorPreferenceSerializer(pref, context={"request": request})
        return Response(serializer.data)


@extend_schema_view(
    create=extend_schema(tags=["department-head"], summary="Batch publish/reject preferences"),
)
class DepartmentHeadBatchPublishView(APIView):
    """Batch publish or reject multiple preferences."""

    permission_classes = [IsDepartmentHead]

    @extend_schema(
        tags=["department-head"],
        summary="Batch publish preferences",
        request=inline_serializer(
            name="BatchPublishRequest",
            fields={
                "preference_ids": serializers.ListField(child=serializers.IntegerField()),
                "action": serializers.ChoiceField(choices=["publish", "reject"]),
                "notes": serializers.CharField(required=False, allow_blank=True),
            },
        ),
        responses={
            200: inline_serializer(
                name="BatchPublishResponse",
                fields={
                    "updated": serializers.IntegerField(),
                    "preferences": ProfessorPreferenceSerializer(many=True),
                },
            ),
        },
    )
    def post(self, request):
        from catalog.models import Department
        user = request.user
        dept = Department.objects.filter(head=user).first()
        if not dept:
            return Response(
                {"detail": "You are not a department head."},
                status=status.HTTP_403_FORBIDDEN,
            )

        preference_ids = request.data.get("preference_ids", [])
        action = request.data.get("action", "publish")
        notes = request.data.get("notes", "")

        if not preference_ids:
            return Response(
                {"detail": "No preferences selected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prefs = ProfessorPreference.objects.filter(
            id__in=preference_ids,
            professor__department=dept,
        ).select_related("professor__department")

        updated = 0
        from django.utils import timezone
        for pref in prefs:
            if pref.status in ["draft", "submitted"]:
                if action == "publish":
                    pref.status = "published"
                    pref.published_at = timezone.now()
                else:
                    pref.status = "rejected"
                pref.reviewed_by = user
                pref.review_notes = notes
                pref.save(update_fields=["status", "published_at", "reviewed_by", "review_notes", "updated_at"])
                pref.submission_items.update(
                    action="publish" if action == "publish" else "reject",
                    notes=notes,
                )
                updated += 1

        serializer = ProfessorPreferenceSerializer(prefs, many=True, context={"request": request})
        return Response({"updated": updated, "preferences": serializer.data})


@extend_schema_view(
    list=extend_schema(tags=["registrar"], summary="List all published preferences"),
)
class RegistrarPublishedPreferencesView(APIView):
    """Registrar views all published preferences for active term."""

    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["registrar"],
        summary="List published preferences",
        parameters=[
            OpenApiParameter(name="term", type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, description="Term ID (defaults to active)"),
        ],
        responses={200: ProfessorPreferenceListSerializer(many=True)},
    )
    def get(self, request):
        from timetable.models import AcademicTerm
        term_id = request.query_params.get("term")
        if term_id:
            try:
                term = AcademicTerm.objects.get(pk=int(term_id))
            except (AcademicTerm.DoesNotExist, ValueError):
                return Response({"detail": "Invalid term."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            term = AcademicTerm.objects.filter(is_active=True).first()
            if not term:
                return Response({"detail": "No active term."}, status=status.HTTP_404_NOT_FOUND)

        prefs = ProfessorPreference.objects.filter(
            term=term,
            status="published",
        ).select_related(
            "professor__user",
            "professor__department",
            "subject",
            "section",
            "term",
        ).order_by("professor__user__last_name", "subject__code")

        serializer = ProfessorPreferenceListSerializer(prefs, many=True, context={"request": request})
        return Response(serializer.data)
