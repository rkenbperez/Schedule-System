from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import AcademicTerm
from apps.scheduling.models import Schedule
from apps.scheduling.serializers import ScheduleSerializer


class StudentScheduleLookupView(APIView):
    """Public, unauthenticated schedule lookup by section code (+ optional term)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        section_code = request.query_params.get('section')
        term_id = request.query_params.get('term')

        if not section_code:
            return Response(
                {'detail': 'The "section" query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        schedules = Schedule.objects.filter(
            section__code__iexact=section_code.strip(),
            is_active=True,
        ).select_related(
            'course_assignment__course',
            'course_assignment__section',
            'course_component',
            'academic_term',
            'teacher',
            'section',
            'room',
        )

        if term_id:
            schedules = schedules.filter(academic_term_id=term_id)
        else:
            term = AcademicTerm.objects.filter(is_active=True).first()
            if term:
                schedules = schedules.filter(academic_term=term)

        serializer = ScheduleSerializer(schedules, many=True)
        return Response(serializer.data)