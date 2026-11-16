from io import BytesIO

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsRegistrar
from timetable.models import ScheduleRun

from .import_utils import processor
from .export_utils import generate_schedule_excel, generate_schedule_pdf


XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_CONTENT_TYPE = "application/pdf"
ZIP_CONTENT_TYPE = "application/zip"


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
        
        # Offload file generation to the service layer
        buf = generate_schedule_excel(run_obj)

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
                description="PDF file containing the list schedule for the given run."
            )
        }
    )
    def get(self, request, pk):
        run_obj = get_object_or_404(ScheduleRun, pk=pk)
        
        # Offload file generation to the service layer
        buf = generate_schedule_pdf(run_obj)

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