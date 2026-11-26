from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema_view, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsRegistrarOrReadOnly

from .models import Department, ProfessorSubject, Room, Section, SectionSubject, Subject
from .serializers import (
    DepartmentSerializer,
    ProfessorSubjectSerializer,
    RoomSerializer,
    SectionSerializer,
    SectionSubjectSerializer,
    SubjectSerializer,
)
from timetable.models import AcademicTerm
from users.models import Professors


@extend_schema_view(
    list=extend_schema(tags=["catalog"]),
    retrieve=extend_schema(tags=["catalog"]),
    create=extend_schema(tags=["catalog"]),
    update=extend_schema(tags=["catalog"]),
    partial_update=extend_schema(tags=["catalog"]),
    destroy=extend_schema(tags=["catalog"]),
)
class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsRegistrarOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        # Subject has no department FK; "department" scopes to subjects that at
        # least one professor of that department is qualified to teach.
        department = self.request.query_params.get("department")
        if department:
            try:
                qs = qs.filter(
                    qualified_professors__professor__department_id=int(department)
                ).distinct()
            except (TypeError, ValueError):
                pass
            else:
                # Unseeded department (no qualifications yet) still needs
                # selectable subjects for its first assignment.
                if not qs.exists():
                    qs = super().get_queryset()
        return qs


@extend_schema_view(
    list=extend_schema(tags=["catalog"]),
    retrieve=extend_schema(tags=["catalog"]),
    create=extend_schema(tags=["catalog"]),
    update=extend_schema(tags=["catalog"]),
    partial_update=extend_schema(tags=["catalog"]),
    destroy=extend_schema(tags=["catalog"]),
)
class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [IsRegistrarOrReadOnly]

    def get_queryset(self):
        qs = Section.objects.all()
        term = self.request.query_params.get("term")
        if term:
            try:
                qs = qs.filter(term_id=int(term))
            except (TypeError, ValueError):
                pass
        return qs


@extend_schema_view(
    list=extend_schema(tags=["catalog"]),
    retrieve=extend_schema(tags=["catalog"]),
    create=extend_schema(tags=["catalog"]),
    update=extend_schema(tags=["catalog"]),
    partial_update=extend_schema(tags=["catalog"]),
    destroy=extend_schema(tags=["catalog"]),
)
class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.select_related("department").all()
    serializer_class = RoomSerializer
    permission_classes = [IsRegistrarOrReadOnly]


@extend_schema_view(
    list=extend_schema(tags=["catalog"]),
    retrieve=extend_schema(tags=["catalog"]),
    create=extend_schema(tags=["catalog"]),
    update=extend_schema(tags=["catalog"]),
    partial_update=extend_schema(tags=["catalog"]),
    destroy=extend_schema(tags=["catalog"]),
)
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related("head").all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsRegistrarOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("headed") == "me":
            qs = qs.filter(head=self.request.user)
        return qs

    def get_permissions(self):
        if self.action in {"professor_subjects", "professor_subject_detail"}:
            return [IsAuthenticated()]
        return super().get_permissions()

    def _ensure_department_manager(self, department):
        user = self.request.user
        if not (user.is_staff or department.head_id == user.id):
            raise PermissionDenied(
                "Only the registrar or this department's head can manage "
                "professor-subject assignments."
            )

    @action(detail=True, methods=["get", "post"], url_path="professor-subjects")
    def professor_subjects(self, request, pk=None):
        department = self.get_object()
        if request.method == "POST":
            self._ensure_department_manager(department)
            professor_id = request.data.get("professor_id")
            subject_id = request.data.get("subject_id")
            try:
                professor = Professors.objects.select_related("department").get(
                    pk=professor_id
                )
                subject = Subject.objects.get(pk=subject_id)
            except (Professors.DoesNotExist, Subject.DoesNotExist, TypeError, ValueError):
                raise ValidationError(
                    {"detail": "A valid professor_id and subject_id are required."}
                )
            if professor.department_id != department.id:
                raise ValidationError(
                    {"professor_id": "Professor does not belong to this department."}
                )
            assignment, created = ProfessorSubject.objects.get_or_create(
                professor=professor,
                subject=subject,
                defaults={"is_preferred": bool(request.data.get("is_preferred", False))},
            )
            if not created and "is_preferred" in request.data:
                assignment.is_preferred = bool(request.data["is_preferred"])
                assignment.save(update_fields=["is_preferred"])
            serializer = ProfessorSubjectSerializer(assignment)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )

        assignments = (
            ProfessorSubject.objects.filter(professor__department=department)
            .select_related("professor__user", "professor__department", "subject")
            .order_by("professor__user__last_name", "subject__code")
        )
        return Response(ProfessorSubjectSerializer(assignments, many=True).data)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"professor-subjects/(?P<assignment_id>[^/.]+)",
    )
    def professor_subject_detail(self, request, pk=None, assignment_id=None):
        department = self.get_object()
        self._ensure_department_manager(department)
        assignment = get_object_or_404(
            ProfessorSubject,
            pk=assignment_id,
            professor__department=department,
        )
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SectionSubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSubjectSerializer
    permission_classes = [IsRegistrarOrReadOnly]

    def get_queryset(self):
        qs = SectionSubject.objects.select_related("section", "subject").all()
        section = self.request.query_params.get("section")
        term = self.request.query_params.get("term")
        if section:
            try:
                qs = qs.filter(section_id=int(section))
            except (TypeError, ValueError):
                pass
        if term:
            try:
                qs = qs.filter(section__term_id=int(term))
            except (TypeError, ValueError):
                pass
        return qs


class AcademicTermsView(APIView):
    """List academic terms for dropdowns / lookups."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        terms = AcademicTerm.objects.all().order_by("-year", "-semester")
        data = [
            {
                "id": t.id,
                "name": t.name,
                "school_year": f"{t.year}-{t.year + 1}",
                "term_type": t.get_semester_display(),
                "start_date": t.start_date,
                "end_date": t.end_date,
                "is_active": t.is_active,
                "created_at": None,
            }
            for t in terms
        ]
        return Response(data)
