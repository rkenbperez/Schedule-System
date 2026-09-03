from drf_spectacular.utils import extend_schema_view, extend_schema
from rest_framework import viewsets

from core.permissions import IsRegistrarOrReadOnly

from .models import Department, Room, Section, Subject
from .serializers import (
    DepartmentSerializer,
    RoomSerializer,
    SectionSerializer,
    SubjectSerializer,
)


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
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsRegistrarOrReadOnly]


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
