from rest_framework import viewsets

from .models import AcademicTerm, Course, CourseComponent, Section
from .serializers import (
    AcademicTermSerializer,
    CourseComponentSerializer,
    CourseSerializer,
    SectionSerializer,
)


class AcademicTermViewSet(viewsets.ModelViewSet):
    queryset = AcademicTerm.objects.all()
    serializer_class = AcademicTermSerializer


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer


class CourseComponentViewSet(viewsets.ModelViewSet):
    queryset = CourseComponent.objects.select_related('course', 'room_type').all()
    serializer_class = CourseComponentSerializer


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.select_related('academic_term').all()
    serializer_class = SectionSerializer