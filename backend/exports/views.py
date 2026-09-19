from datetime import date
from io import BytesIO

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from rest_framework.views import APIView

from core.permissions import IsRegistrar
from timetable.models import ScheduledClass, ScheduleRun


XLSX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

PDF_CONTENT_TYPE = "application/pdf"


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


class SchedulePdfExportView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["exports"],
        responses={
            200: OpenApiResponse(
                description="PDF file containing the schedule for the given run."
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

        styles = getSampleStyleSheet()
        cell_style = styles["Normal"]
        title_style = styles["Title"]

        header = [
            "Day", "Start", "End",
            "Subject Code", "Title", "Section",
            "Professor", "Room", "Mode",
        ]
        data_rows = [[Paragraph(h, cell_style) for h in header]]

        for c in classes:
            prof_user = c.assignment.prof.user
            professor_name = prof_user.get_full_name() or prof_user.username
            data_rows.append([
                Paragraph(c.get_day_display(), cell_style),
                Paragraph(c.start_time.strftime("%H:%M"), cell_style),
                Paragraph(c.end_time.strftime("%H:%M"), cell_style),
                Paragraph(c.assignment.subject.code, cell_style),
                Paragraph(c.assignment.subject.title, cell_style),
                Paragraph(c.assignment.section.name, cell_style),
                Paragraph(professor_name, cell_style),
                Paragraph(c.room.name if c.room else "", cell_style),
                Paragraph(c.get_mode_display() if c.mode else "", cell_style),
            ])

        table = Table(data_rows, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), (colors.white, colors.lightgrey)),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))

        elements = [
            Paragraph(f"Schedule Run #{pk}", title_style),
            Paragraph(f"Generated: {date.today().isoformat()}", cell_style),
            Spacer(1, 8 * mm),
            table,
        ]

        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A4),
            title=f"Schedule Run {pk}",
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )
        doc.build(elements)
        buf.seek(0)

        return FileResponse(
            buf,
            as_attachment=True,
            filename=f"schedule_run_{pk}.pdf",
            content_type=PDF_CONTENT_TYPE,
        )