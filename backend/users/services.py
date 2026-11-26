"""Service layer for provisioning professor accounts during imports.

Professors are matched on normalized (trimmed, lowercased) email. New emails
create a login account plus profile; existing emails update the account and
profile. Passwords are never set or reset on updates, and new accounts get an
unusable password until the user sets one.
"""

from dataclasses import dataclass
from typing import Any, Literal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils.text import slugify


def normalize_email(value: str) -> str:
    """Trim and lowercase an email address."""
    return (value or "").strip().lower()


@dataclass
class ProvisionResult:
    action: Literal["created", "updated"]
    user: Any
    professor: Any
    user_created: bool
    professor_created: bool


def _unique_username(email: str) -> str:
    """Derive a unique, slugified username from the email's local part."""
    User = get_user_model()
    base = slugify(email.split("@", 1)[0])[:148] or "user"
    username = base
    suffix = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}{suffix}"[:150]
        suffix += 1
    return username


def _positive_int(value, name: str):
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a positive integer")
    if parsed < 1:
        raise ValueError(f"{name} must be a positive integer")
    return parsed


def provision_professor(
    *,
    email,
    first_name="",
    last_name="",
    department_id=None,
    max_daily_hours=None,
    max_consecutive=None,
    dry_run=False,
) -> ProvisionResult:
    """Create or update a professor account matched by normalized email.

    Returns a ProvisionResult whose ``action`` is "created" when the
    Professors profile row is new and "updated" when an existing profile row
    was matched (even if the values are identical). Performs all reads and
    classification for ``dry_run=True`` without saving anything. The caller is
    responsible for wrapping real runs in transaction.atomic().
    """
    # Imported lazily: users.models imports catalog.models at module load.
    from users.models import Professors
    from catalog.models import Department

    email = normalize_email(email)
    if not email:
        raise ValueError("email is required")
    try:
        validate_email(email)
    except DjangoValidationError:
        raise ValueError(f"Invalid email address: '{email}'")

    max_daily_hours = _positive_int(max_daily_hours, "max_daily_hours")
    max_consecutive = _positive_int(max_consecutive, "max_consecutive")

    if department_id is not None and not Department.objects.filter(
        pk=department_id
    ).exists():
        raise ValueError(f"Department {department_id} does not exist")

    User = get_user_model()
    matches = User.objects.filter(email__iexact=email)
    count = matches.count()
    if count > 1:
        raise ValueError("email matches multiple users")

    first_name = (first_name or "").strip()
    last_name = (last_name or "").strip()

    def _apply_prof_fields(professor) -> None:
        if department_id is not None:
            professor.department_id = department_id
        if max_daily_hours is not None:
            professor.max_daily_hours = max_daily_hours
        if max_consecutive is not None:
            professor.max_consecutive = max_consecutive

    if count == 0:
        # Create path: new login account + profile. Model defaults (8/4)
        # apply when the corresponding arguments are None.
        user = User(
            email=email,
            username=_unique_username(email),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        user.set_unusable_password()
        professor = Professors()
        _apply_prof_fields(professor)
        if not dry_run:
            user.save()
            professor.user = user
            professor.save()
        return ProvisionResult("created", user, professor, True, True)

    user = matches.first()
    professor = Professors.objects.filter(user=user).first()
    professor_created = professor is None
    if professor is None:
        professor = Professors(user=user)
    _apply_prof_fields(professor)

    if not dry_run:
        user_changed = False
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            user_changed = True
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            user_changed = True
        if user_changed:
            # Only names are updated; never touch email, username, or password.
            user.save()
        professor.save()

    return ProvisionResult(
        "created" if professor_created else "updated",
        user,
        professor,
        False,
        professor_created,
    )
