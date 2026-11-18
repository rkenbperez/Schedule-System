from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


class EmailAuthBackend(ModelBackend):
    """Authenticate a user by email (case-insensitive) instead of username."""

    def authenticate(self, request, email=None, password=None, **kwargs):
        if email is None:
            return None

        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Run the default password hasher once to avoid timing attacks
            # even when the email does not exist.
            User().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
