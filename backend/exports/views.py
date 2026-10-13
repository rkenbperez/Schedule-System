from datetime import date
from io import BytesIO
import zipfile

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsRegistrar
from timetable.models import ScheduledClass, ScheduleRun

from .import_utils import processor


XLSX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)
PDF_CONTENT_TYPE = "application/pdf"
ZIP_CONTENT_TYPE = "application/zip"

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


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


class ScheduleExportPDFView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["exports"],
        responses={
            200: OpenApiResponse(
                description="PDF file containing the weekly grid schedule for the given run."
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

        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A4),
            leftMargin=1*cm,
            rightMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm,
        )

        styles = getSampleStyleSheet()
        header_style = styles["Normal"]
        header_style.fontName = "Helvetica-Bold"
        header_style.fontSize = 8
        header_style.leading = 10
        cell_style = styles["Normal"]
        cell_style.fontName = "Helvetica"
        cell_style.fontSize = 7
        cell_style.leading = 9

        time_slots = self._get_time_slots(classes)
        grid = self._build_grid(classes, time_slots)

        data = []
        header_row = [Paragraph("Time", header_style)] + [Paragraph(d, header_style) for d in WEEKDAYS]
        data.append(header_row)

        for time_label, row_data in zip(time_slots, grid):
            row = [Paragraph(time_label, header_style)]
            for cell_content in row_data:
                row.append(Paragraph(cell_content, cell_style))
            data.append(row)

        col_widths = [2.5*cm] + [18.5*cm/6]*6
        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#ecf0f1")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bdc3c7")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
        ]))

        title = Paragraph(f"Schedule Run #{pk} - Weekly Grid", styles["Title"])
        doc.build([title, table])

        buf.seek(0)

        return FileResponse(
            buf,
            as_attachment=True,
            filename=f"schedule_run_{pk}.pdf",
            content_type=PDF_CONTENT_TYPE,
        )

    def _get_time_slots(self, classes):
        if not classes:
            return ["08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00",
                    "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00",
                    "17:00-18:00", "18:00-19:00", "19:00-20:00"]

        times = set()
        for c in classes:
            start = c.start_time
            end = c.end_time
            times.add((start, end))
        sorted_times = sorted(times)
        return [f"{s.strftime('%H:%M')}-{e.strftime('%H:%M')}" for s, e in sorted_times]

    def _build_grid(self, classes, time_slots):
        grid = [["" for _ in WEEKDAYS] for _ in time_slots]

        time_slot_map = {}
        for i, ts in enumerate(time_slots):
            start_str, end_str = ts.split("-")
            time_slot_map[(start_str, end_str)] = i

        for c in classes:
            day_idx = c.day
            start_str = c.start_time.strftime("%H:%M")
            end_str = c.end_time.strftime("%H:%M")
            row_idx = time_slot_map.get((start_str, end_str))

            if row_idx is not None and 0 <= day_idx < 6:
                prof_user = c.assignment.prof.user
                prof_name = prof_user.get_full_name() or prof_user.username
                room_name = c.room.name if c.room else "TBA"
                cell_text = (
                    f"{c.assignment.subject.code} - {c.assignment.subject.title}\n"
                    f"{c.assignment.section.name}\n"
                    f"{prof_name}\n"
                    f"{room_name} ({c.get_mode_display() if c.mode else 'N/A'})"
                )
                existing = grid[row_idx][day_idx]
                if existing:
                    grid[row_idx][day_idx] = existing + "\n\n---\n\n" + cell_text
                else:
                    grid[row_idx][day_idx] = cell_text

        return grid


class ImportPreviewView(APIView):
    permission_classes = [IsRegistrar]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["imports"],
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {
                    "file": {"type": "string", "format": "binary"}
                },
                "required": ["file"]
            }
        },
        responses={
            200: OpenApiResponse(description="Preview of import changes"),
            400: OpenApiResponse(description="Validation errors"),
        }
    )
    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            parsed = processor.parse_file(file)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Failed to parse file: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        result = processor.validate_all(parsed)

        response_data = {
            "valid": result.valid,
            "preview_token": result.preview_token,
            "summary": result.summary,
            "details": result.details,
            "errors": [
                {"sheet": e.sheet, "row": e.row, "field": e.field, "message": e.message}
                for e in result.errors
            ],
        }

        if result.valid:
            return Response(response_data, status=status.HTTP_200_OK)
        return Response(response_data, status=status.HTTP_400_BAD_REQUEST)


class ImportCommitView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["imports"],
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "preview_token": {"type": "string"}
                },
                "required": ["preview_token"]
            }
        },
        responses={
            200: OpenApiResponse(description="Import committed successfully"),
            400: OpenApiResponse(description="Invalid or expired preview token"),
        }
    )
    def post(self, request):
        preview_token = request.data.get("preview_token")
        if not preview_token:
            return Response({"detail": "preview_token is required"}, status=status.HTTP_400_BAD_REQUEST)

        result = processor.commit(preview_token)

        if result.committed:
            return Response({
                "committed": True,
                "summary": result.summary
            }, status=status.HTTP_200_OK)
        return Response({
            "committed": False,
            "errors": result.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class TemplateView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["imports"],
        responses={
            200: OpenApiResponse(description="XLSX template file"),
        }
    )
    def get(self, request):
        content = processor.generate_template_xlsx()
        buf = BytesIO(content)
        return FileResponse(
            buf,
            as_attachment=True,
            filename="schedule_import_template.xlsx",
            content_type=XLSX_CONTENT_TYPE,
        )


class TemplateCSVView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["imports"],
        responses={
            200: OpenApiResponse(description="CSV template ZIP file"),
        }
    )
    def get(self, request):
        content = processor.generate_template_csv_zip()
        buf = BytesIO(content)
        return FileResponse(
            buf,
            as_attachment=True,
            filename="schedule_import_template.zip",
            content_type=ZIP_CONTENT_TYPE,
        )