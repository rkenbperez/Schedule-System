from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from apps.academics.serializers import (
    CourseComponentSerializer,
    CourseSerializer,
    SectionSerializer,
)

from .models import CourseAssignment, Schedule
from .service import NoAvailableRoom, create_schedule
from .serializers import (
    CourseAssignmentSerializer,
    ScheduleSerializer,
    ScheduleWriteSerializer,
)


class CourseAssignmentViewSet(viewsets.ModelViewSet):

    queryset = CourseAssignment.objects.select_related(
        'academic_term',
        'teacher',
        'course',
        'section',
    ).all()

    serializer_class = CourseAssignmentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        teacher_id = self.request.query_params.get('teacherId')

        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)

        return queryset


class ScheduleViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.AllowAny]
    
    queryset = Schedule.objects.select_related(
        'course_assignment__academic_term',
        'course_assignment__teacher',
        'course_assignment__course',
        'course_assignment__section',
        'course_component__course',
        'course_component__room_type',
        'academic_term',
        'teacher',
        'section',
        'room__room_type',
    ).all()

    def get_queryset(self):
        queryset = super().get_queryset()

        teacher_id = self.request.query_params.get('teacher')
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)

        return queryset

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ScheduleWriteSerializer
        return ScheduleSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        
        try:
            schedule = create_schedule(
                assignment=serializer.validated_data['course_assignment'],
                component=serializer.validated_data['course_component'],
                start_time=serializer.validated_data['start_time'],
                day_of_week=serializer.validated_data['day_of_week'],
            )
        except NoAvailableRoom as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_409_CONFLICT
            )

        return Response(
            ScheduleSerializer(schedule).data,
            status=status.HTTP_201_CREATED
        )
    
  