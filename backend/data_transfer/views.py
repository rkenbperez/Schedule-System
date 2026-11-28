from io import BytesIO

from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsRegistrar
from timetable.models import ScheduleRun

from .import_utils import processor
from .models import ImportBatch
from .export_utils import generate_schedule_csv, generate_schedule_excel, generate_schedule_pdf


XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PDF_CONTENT_TYPE = "application/pdf"
CSV_CONTENT_TYPE = "text/csv"
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


class ScheduleExportCSVView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(
        tags=["exports"],
        responses={
            200: OpenApiResponse(
                description="CSV file containing the schedule for the given run."
            )
        }
    )
    def get(self, request, pk):
        run_obj = get_object_or_404(ScheduleRun, pk=pk)

        csv_bytes = generate_schedule_csv(run_obj)

        return HttpResponse(
            csv_bytes,
            content_type=f'{CSV_CONTENT_TYPE}; charset=utf-8',
            headers={
                'Content-Disposition': f'attachment; filename="schedule_run_{pk}.csv"',
            },
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

        result = processor.validate_all(
            parsed, filename=getattr(file, "name", "")
        )

        response_data = {
            "valid": result.valid,
            "preview_token": result.preview_token,
            "summary": result.summary,
            "details": result.details,
            "preview_items": result.preview_items,
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
                    "preview_token": {"type": "string"},
                    "selected_keys": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
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

        selected_keys = request.data.get("selected_keys")
        if selected_keys is not None and not isinstance(selected_keys, list):
            return Response({"detail": "selected_keys must be a list"}, status=status.HTTP_400_BAD_REQUEST)

        result = processor.commit(preview_token, selected_keys, submitted_by=request.user)

        if result.committed:
            return Response({
                "committed": True,
                "summary": result.summary,
                "batch_id": result.batch_id,
            }, status=status.HTTP_200_OK)
        return Response({
            "committed": False,
            "errors": result.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class ImportBatchListView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(tags=["imports"])
    def get(self, request):
        batches = ImportBatch.objects.select_related("uploaded_by").all()
        return Response(
            [
                {
                    "id": batch.id,
                    "filename": batch.filename,
                    "status": batch.status,
                    "summary": batch.summary,
                    "uploaded_by": (
                        batch.uploaded_by.email if batch.uploaded_by else None
                    ),
                    "created_at": batch.created_at,
                }
                for batch in batches
            ]
        )


class ImportBatchRollbackView(APIView):
    permission_classes = [IsRegistrar]

    @extend_schema(tags=["imports"])
    def post(self, request, pk):
        batch = get_object_or_404(ImportBatch, pk=pk)
        try:
            processor.rollback(batch)
        except ValueError as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {"id": batch.id, "status": batch.status},
            status=status.HTTP_200_OK,
        )


class TemplateView(APIView):
    permission_classes = [IsRegistrar]

    def perform_content_negotiation(self, request, force=False):
        """Prevent DRF from treating ?format= as a renderer override.

        DRF normally reserves the ``format`` query parameter for response
        renderers and raises 404 for unknown values. This endpoint uses
        ``format`` to choose the downloaded template instead, so hide it from
        renderer negotiation and restore it before the view runs.
        """
        query_params = request.query_params
        if "format" not in query_params:
            return super().perform_content_negotiation(request, force=force)

        original_get = request._request.GET
        stripped_get = original_get.copy()
        stripped_get.pop("format", None)
        request._request.GET = stripped_get
        try:
            return super().perform_content_negotiation(request, force=force)
        finally:
            request._request.GET = original_get

    @extend_schema(
        tags=["imports"],
        parameters=[
            OpenApiParameter(
                name="format",
                type=str,
                location=OpenApiParameter.QUERY,
                enum=["xlsx", "csv"],
                default="xlsx",
                description=(
                    "Template format. 'xlsx' returns a multi-sheet workbook; "
                    "'csv' returns a ZIP containing one CSV per sheet, which "
                    "is the CSV format accepted by the importer."
                ),
            )
        ],
        responses={
            200: OpenApiResponse(
                description="XLSX template or CSV ZIP template"
            ),
            400: OpenApiResponse(description="Unsupported template format"),
        },
    )
    def get(self, request):
        template_format = (
            request.query_params.get("format") or "xlsx"
        ).strip().lower()

        if template_format == "xlsx":
            content = processor.generate_template_xlsx()
            buf = BytesIO(content)
            return FileResponse(
                buf,
                as_attachment=True,
                filename="schedule_import_template.xlsx",
                content_type=XLSX_CONTENT_TYPE,
            )

        if template_format == "csv":
            content = processor.generate_template_csv_zip()
            buf = BytesIO(content)
            return FileResponse(
                buf,
                as_attachment=True,
                filename="schedule_import_template.zip",
                content_type=ZIP_CONTENT_TYPE,
            )

        return Response(
            {
                "detail": (
                    "Unsupported template format. Use ?format=xlsx or "
                    "?format=csv."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
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