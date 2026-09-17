from io import BytesIO

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from openpyxl import Workbook
from rest_framework.views import APIView

from core.permissions import IsRegistrar
from timetable.models import ScheduledClass, ScheduleRun


XLSX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


class ScheduleExportView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["exports"],
        responses={
            200: OpenApiResponse(
                description="XLSX file containing the schedule for the given run."
            )
        }
    )
    def get(self, request, pk):
        run_obj = get_object_or_404(ScheduleRun, pk=pk)

        classes = (
            ScheduledClass.objects
            .filter(run=run_obj)
            .select_related(
                "assignment__prof__user",
                "assignment__subject",
                "assignment__section",
                "room",
            )
            .order_by("day", "start_time")
        )

        wb = Workbook()
        ws = wb.active
        ws.title = "Schedule"

        ws.append([
            "Day",
            "Start",
            "End",
            "Subject Code",
            "Title",
            "Section",
            "Professor",
            "Room",
            "Mode",
        ])

        for c in classes:
            prof_user = c.assignment.prof.user
            professor_name = prof_user.get_full_name() or prof_user.username
            ws.append([
                c.get_day_display(),
                c.start_time.strftime("%H:%M"),
                c.end_time.strftime("%H:%M"),
                c.assignment.subject.code,
                c.assignment.subject.title,
                c.assignment.section.name,
                professor_name,
                c.room.name if c.room else "",
                c.get_mode_display() if c.mode else "",
            ])

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)

        return FileResponse(
            buf,
            as_attachment=True,
            filename=f"schedule_run_{pk}.xlsx",
            content_type=XLSX_CONTENT_TYPE,
        )