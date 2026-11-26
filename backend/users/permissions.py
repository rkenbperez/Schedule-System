from rest_framework.permissions import BasePermission

from .models import Professors


class IsRegistrar(BasePermission):
    """Allow access only to registrar (staff users)."""

    def has_permission(self, request, view):
        return request.user and request.user.is_staff


class IsProfessor(BasePermission):
    """Allow access only to the professor owning the object."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if hasattr(obj, "professor"):
            return obj.professor.user == request.user
        if isinstance(obj, Professors):
            return obj.user == request.user
        return False


class IsDepartmentHead(BasePermission):
    """Allow access only to department heads for their department."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        from catalog.models import Department
        return Department.objects.filter(head=request.user).exists()

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if hasattr(obj, "department"):
            return obj.department.head == request.user
        if hasattr(obj, "professor") and hasattr(obj.professor, "department"):
            return obj.professor.department and obj.professor.department.head == request.user
        return False


class IsProfessorOrDepartmentHead(BasePermission):
    """Allow access to professor owning the object or their department head."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_staff:
            return True

        if hasattr(obj, "professor"):
            professor = obj.professor
            if professor.user == request.user:
                return True
            if professor.department and professor.department.head == request.user:
                return True
        return False