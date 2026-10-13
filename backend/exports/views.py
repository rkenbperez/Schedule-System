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
                description="PDF file containing the flat-table schedule for the given run."
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

        # Header style: 9pt bold, light blue background
        header_style = styles["Normal"].clone("PDFHeaderStyle")
        header_style.fontName = "Helvetica-Bold"
        header_style.fontSize = 9
        header_style.leading = 11

        # Cell style: 8pt normal
        cell_style = styles["Normal"].clone("PDFCellStyle")
        cell_style.fontName = "Helvetica"
        cell_style.fontSize = 8
        cell_style.leading = 9.5

        # Build table data: one row per class, 9 columns matching Excel
        DATA_COLUMNS = 9
        header = [
            Paragraph("Day", header_style),
            Paragraph("Start", header_style),
            Paragraph("End", header_style),
            Paragraph("Subject Code", header_style),
            Paragraph("Title", header_style),
            Paragraph("Section", header_style),
            Paragraph("Professor", header_style),
            Paragraph("Room", header_style),
            Paragraph("Mode", header_style),
        ]

        data = [header]

        for c in classes:
            day_label = c.get_day_display()
            start_label = c.start_time.strftime("%H:%M")
            end_label = c.end_time.strftime("%H:%M")
            subject_code = c.assignment.subject.code
            title = c.assignment.subject.title
            section = c.assignment.section.name
            prof_user = c.assignment.prof.user
            prof_name = prof_user.get_full_name() or prof_user.username
            room_name = c.room.name if c.room else ""
            mode_display = c.get_mode_display() if c.mode else ""

            # Build title paragraph with wrapping (max 2 lines, 70mm width)
            title_para = Paragraph(
                f"<b>{subject_code}</b><br/>{title}",
                cell_style,
            )

            row = [
                Paragraph(day_label, cell_style),
                Paragraph(start_label, cell_style),
                Paragraph(end_label, cell_style),
                Paragraph(subject_code, cell_style),
                title_para,
                Paragraph(section, cell_style),
                Paragraph(prof_name, cell_style),
                Paragraph(room_name, cell_style),
                Paragraph(mode_display, cell_style),
            ]
            data.append(row)

        # Column widths in points (mm × 2.83465), total ~652pt within A4 landscape usable width ~785pt
        MM_TO_PT = 2.83465
        col_widths_pt = [
            22 * MM_TO_PT,   # Day: 22mm
            14 * MM_TO_PT,   # Start: 14mm
            14 * MM_TO_PT,   # End: 14mm
            22 * MM_TO_PT,   # Subject Code: 22mm
            70 * MM_TO_PT,   # Title: 70mm
            20 * MM_TO_PT,   # Section: 20mm
            26 * MM_TO_PT,   # Professor: 26mm
            16 * MM_TO_PT,   # Room: 16mm
            26 * MM_TO_PT,   # Mode: 26mm
        ]

        table = Table(data, colWidths=col_widths_pt, repeatRows=1)

        # Styling: thin light-gray gridlines (0.25pt)
        # reportlab TableStyle uses width in points; 0.25pt = 0.25
        style_cmds = [
            # Header row: bold background light blue gray
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1a202c")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            # All cells: thin gridlines 0.25pt light gray
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e0")),
            # Vertical alignment: TOP (prevents cell height issues)
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            # Header row height emphasis
            ("TOPPADDING", (0, 0), (-1, 0), 4),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            # Alternating row shading (very light gray)
            # We'll apply a light shading to every other row starting from row 1 (index 1 is first data row)
            *[
                ("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f7fafc"))
                for i in range(1, len(data), 2)
            ],
        ]

        table.setStyle(TableStyle(style_cmds))

        # Title above the table
        title = Paragraph(f"Schedule Run #{pk} - Flat Table", styles["Title"])

        # Build the PDF with pagination
        doc.build([title, table])

        buf.seek(0)

        return FileResponse(
            buf,
            as_attachment=True,
            filename=f"schedule_run_{pk}.pdf",
            content_type=PDF_CONTENT_TYPE,
        )


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