"""Shared DRF permission classes.

Roles:
- Registrar = a Django User with ``is_staff=True`` (no ``Professors`` row).
- Professor = a Django User with ``is_staff=False`` linked to a ``Professors`` row.
- Student = a Django User with ``is_staff=False`` linked to a ``Student`` row (future).
- Public = unauthenticated access for published schedules.
"""

from rest_framework import permissions


class IsRegistrar(permissions.BasePermission):
    """Only staff (registrar) accounts may access the view."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsRegistrarOrReadOnly(permissions.BasePermission):
    """Any authenticated user may read; only registrars may write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_staff


class IsProfessor(permissions.BasePermission):
    """User has a linked Professors profile (non-staff)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_staff
            and hasattr(request.user, "prof")
        )


class IsStudent(permissions.BasePermission):
    """User has a linked Student profile (non-staff). Future use."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_staff
            and hasattr(request.user, "student")
        )


class IsPublicReadOnly(permissions.BasePermission):
    """Allow unauthenticated read access to published schedules."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


class IsOwnerOrRegistrar(permissions.BasePermission):
    """Object-level: registrars may do anything; profs may only touch their own.

    Assumes the object exposes ``obj.prof`` (a ``Professors`` instance with a
    ``user`` OneToOne link).
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return obj.prof.user == request.user


class IsEnrolledInSection(permissions.BasePermission):
    """Object-level: student can only view schedules for enrolled sections.
    Future use when Student/Enrollment models exist.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        student = getattr(request.user, "student", None)
        if not student:
            return False
        # obj could be ScheduledClass, Section, etc.
        section_id = getattr(obj, "assignment__section_id", None) or getattr(obj, "section_id", None)
        if not section_id:
            return False
        from timetable.models import Enrollment
        return Enrollment.objects.filter(
            student=student, section_id=section_id, status="enrolled"
        ).exists()
