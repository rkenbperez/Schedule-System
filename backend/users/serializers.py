from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

from .models import PasswordResetToken, Professors, ProfessorPreference, PreferenceSubmission, SubmissionItem


class ProfessorsSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    department_name = serializers.CharField(
        source="department.name", read_only=True, default=""
    )
    email = serializers.EmailField(source="user.email", read_only=True)
    is_staff = serializers.BooleanField(source="user.is_staff", read_only=True)
    role = serializers.SerializerMethodField(read_only=True)
    is_department_head = serializers.SerializerMethodField(read_only=True)
    
    user_email = serializers.EmailField(write_only=True, required=False)
    user_password = serializers.CharField(write_only=True, required=False)
    user_is_staff = serializers.BooleanField(write_only=True, required=False, default=False)
    department_head = serializers.BooleanField(write_only=True, required=False, default=False)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True, required=False)

    class Meta:
        model = Professors
        fields = [
            "id",
            "user",
            "username",
            "full_name",
            "email",
            "department",
            "department_name",
            "max_daily_hours",
            "max_consecutive",
            "is_staff",
            "role",
            "is_department_head",
            "user_email",
            "user_password",
            "user_is_staff",
            "department_head",
        ]
        read_only_fields = ["id", "user", "username", "full_name", "email", "is_staff", "role", "is_department_head"]

    def get_full_name(self, obj):
        full_name = obj.user.get_full_name().strip()
        return full_name or obj.user.username

    def get_role(self, obj):
        from .services import user_role_and_department

        return user_role_and_department(obj.user)[0]

    def get_is_department_head(self, obj):
        if obj.department and obj.department.head_id == obj.user_id:
            return True
        return False

    def create(self, validated_data):
        user_email = validated_data.pop("user_email", None)
        user_password = validated_data.pop("user_password", None)
        user_is_staff = validated_data.pop("user_is_staff", False)
        department_head = validated_data.pop("department_head", False)
        user_obj = validated_data.pop("user", None)
        
        User = get_user_model()
        
        if user_obj:
            # Backward compatibility: user ID or User object provided
            if isinstance(user_obj, User):
                user = user_obj
            else:
                try:
                    user = User.objects.get(pk=user_obj)
                except User.DoesNotExist:
                    raise serializers.ValidationError("User not found")
        elif user_email:
            user, created = User.objects.get_or_create(
                email=user_email,
                defaults={"username": user_email, "is_staff": user_is_staff}
            )
            if created and user_password:
                user.set_password(user_password)
            elif created:
                user.set_unusable_password()
            user.is_staff = user_is_staff
            user.save()
        else:
            raise serializers.ValidationError("user or user_email is required")
        
        professor = Professors.objects.create(user=user, **validated_data)
        
        if department_head and professor.department:
            professor.department.head = user
            professor.department.save(update_fields=["head"])
        
        return professor

    def update(self, instance, validated_data):
        department_head = validated_data.pop("department_head", None)
        
        professor = super().update(instance, validated_data)
        
        if department_head is not None and professor.department:
            if department_head:
                professor.department.head = professor.user
            else:
                if professor.department.head_id == professor.user_id:
                    professor.department.head = None
            professor.department.save(update_fields=["head"])
        
        return professor


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
        from .services import user_role_and_department

        role, dept_data = user_role_and_department(self.user)
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
            "department": dept_data,
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


class MeetingPreferenceSerializer(serializers.Serializer):
    """Serializer for individual meeting preferences within ProfessorPreference.meetings JSON."""

    mode = serializers.ChoiceField(choices=["sync", "lab", "async"])
    duration_slots = serializers.IntegerField(min_value=1, max_value=8)
    preferred_days = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        required=False,
        default=list,
    )
    preferred_start = serializers.TimeField(required=False, allow_null=True)
    preferred_end = serializers.TimeField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("preferred_start") and attrs.get("preferred_end"):
            if attrs["preferred_start"] >= attrs["preferred_end"]:
                raise serializers.ValidationError("preferred_start must be before preferred_end")
        return attrs


class ProfessorPreferenceSerializer(serializers.ModelSerializer):
    """Full serializer for ProfessorPreference with nested meetings validation."""

    professor_name = serializers.CharField(source="professor.user.get_full_name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_title = serializers.CharField(source="subject.title", read_only=True)
    section_name = serializers.CharField(
        source="section.name", read_only=True, allow_null=True
    )
    term_code = serializers.CharField(source="term.code", read_only=True)
    meetings_validated = MeetingPreferenceSerializer(many=True, source="meetings", read_only=True)
    professor_department = serializers.CharField(source="professor.department.name", read_only=True, allow_null=True)
    department_id = serializers.IntegerField(source="professor.department.id", read_only=True, allow_null=True)

    class Meta:
        model = ProfessorPreference
        fields = [
            "id",
            "professor",
            "professor_name",
            "professor_department",
            "department_id",
            "subject",
            "subject_code",
            "subject_title",
            "section",
            "section_name",
            "term",
            "term_code",
            "meetings",
            "meetings_validated",
            "status",
            "submitted_at",
            "published_at",
            "reviewed_by",
            "review_notes",
            "created_at",
            "updated_at",
        ]
        # The default UniqueTogetherValidator (professor, subject, section,
        # term) demands a section value even though imported preferences have
        # none; validate() below covers the same rule for NULL sections.
        validators = []
        read_only_fields = [
            "id",
            "professor",
            "professor_name",
            "professor_department",
            "department_id",
            "subject_code",
            "subject_title",
            "section_name",
            "term_code",
            "meetings_validated",
            "submitted_at",
            "published_at",
            "reviewed_by",
            "review_notes",
            "created_at",
            "updated_at",
        ]

    def validate_meetings(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Meetings must be a list.")
        if not value:
            raise serializers.ValidationError("At least one meeting is required.")
        serializer = MeetingPreferenceSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def validate(self, attrs):
        professor = attrs.get("professor") or (self.instance.professor if self.instance else None)
        if professor is None:
            # perform_create injects the professor after validation; read it
            # from the request so create-time duplicate checks still run.
            user = getattr(self.context.get("request"), "user", None)
            professor = getattr(user, "prof", None)
        term = attrs.get("term") or (self.instance.term if self.instance else None)

        if professor and term:
            qs = ProfessorPreference.objects.filter(professor=professor, term=term)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            subject = attrs.get("subject") or (self.instance.subject if self.instance else None)
            section = attrs.get("section") or (self.instance.section if self.instance else None)
            if subject:
                # section may be None (imported preferred-subject rows); the
                # conditional unique constraint treats NULL as one section.
                if qs.filter(subject=subject, section=section).exists():
                    raise serializers.ValidationError(
                        "A preference for this subject and section already exists for this term."
                    )
        return attrs


class ProfessorPreferenceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing preferences."""

    professor_name = serializers.CharField(source="professor.user.get_full_name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_title = serializers.CharField(source="subject.title", read_only=True)
    section_name = serializers.CharField(
        source="section.name", read_only=True, allow_null=True
    )
    term_code = serializers.CharField(source="term.code", read_only=True)
    meeting_count = serializers.SerializerMethodField()
    total_duration = serializers.SerializerMethodField()

    class Meta:
        model = ProfessorPreference
        fields = [
            "id",
            "professor",
            "professor_name",
            "subject",
            "subject_code",
            "subject_title",
            "section",
            "section_name",
            "term",
            "term_code",
            "meetings",
            "meeting_count",
            "total_duration",
            "status",
            "submitted_at",
            "published_at",
            "reviewed_by",
            "review_notes",
            "created_at",
            "updated_at",
        ]

    def get_meeting_count(self, obj):
        return len(obj.meetings) if obj.meetings else 0

    def get_total_duration(self, obj):
        return sum(m.get("duration_slots", 0) for m in obj.meetings) if obj.meetings else 0


class SubmissionItemSerializer(serializers.ModelSerializer):
    preference = ProfessorPreferenceListSerializer(read_only=True)
    preference_id = serializers.PrimaryKeyRelatedField(
        queryset=ProfessorPreference.objects.all(),
        source="preference",
        write_only=True,
    )

    class Meta:
        model = SubmissionItem
        fields = ["id", "preference", "preference_id", "action", "notes"]


class PreferenceSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for batch submissions from department head."""

    department_name = serializers.CharField(source="department.name", read_only=True)
    term_code = serializers.CharField(source="term.code", read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.get_full_name", read_only=True)
    items = SubmissionItemSerializer(many=True, read_only=True)
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    item_actions = serializers.DictField(
        child=serializers.ChoiceField(choices=["publish", "reject"]),
        write_only=True,
        required=False,
    )

    class Meta:
        model = PreferenceSubmission
        fields = [
            "id",
            "department",
            "department_name",
            "term",
            "term_code",
            "submitted_by",
            "submitted_by_name",
            "submitted_at",
            "status",
            "items",
            "item_ids",
            "item_actions",
        ]
        read_only_fields = [
            "id",
            "submitted_by",
            "submitted_by_name",
            "submitted_at",
            "status",
            "items",
        ]

    def create(self, validated_data):
        item_ids = validated_data.pop("item_ids", [])
        item_actions = validated_data.pop("item_actions", {})
        validated_data["submitted_by"] = self.context["request"].user
        submission = super().create(validated_data)

        for pref_id in item_ids:
            action = item_actions.get(str(pref_id), "publish")
            SubmissionItem.objects.create(
                submission=submission,
                preference_id=pref_id,
                action=action,
            )

        for pref_id in item_ids:
            pref = ProfessorPreference.objects.get(pk=pref_id)
            if item_actions.get(str(pref_id), "publish") == "publish":
                pref.status = "published"
            else:
                pref.status = "rejected"
            pref.reviewed_by = self.context["request"].user
            from django.utils import timezone
            pref.published_at = timezone.now()
            pref.save(update_fields=["status", "reviewed_by", "published_at", "updated_at"])

        submission.status = "accepted"
        submission.save(update_fields=["status"])
        return submission
