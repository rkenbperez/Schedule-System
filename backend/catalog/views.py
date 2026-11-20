from drf_spectacular.utils import extend_schema_view, extend_schema
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsRegistrarOrReadOnly

from .models import Department, Room, Section, Subject
from .serializers import (
    DepartmentSerializer,
    RoomSerializer,
    SectionSerializer,
    SubjectSerializer,
)
from timetable.models import AcademicTerm


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
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsRegistrarOrReadOnly]


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
