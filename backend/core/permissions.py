"""Shared DRF permission classes.

Roles:
- Registrar = a Django User with ``is_staff=True`` (no ``Professors`` row).
- Prof = a Django User with ``is_staff=False`` linked to a ``Professors`` row.
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
