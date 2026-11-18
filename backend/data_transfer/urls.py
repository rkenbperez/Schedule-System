from django.urls import path

from .views import (
    ScheduleExportCSVView,
    ScheduleExportPDFView,
    ScheduleExportView,
    ImportPreviewView,
    ImportCommitView,
    TemplateView,
    TemplateCSVView,
)

urlpatterns = [
    path(
        "exports/schedules/<int:pk>.xlsx",
        ScheduleExportView.as_view(),
        name="schedule-export",
    ),
    path(
        "exports/schedules/<int:pk>.csv",
        ScheduleExportCSVView.as_view(),
        name="schedule-export-csv",
    ),
    path(
        "exports/schedules/<int:pk>.pdf",
        ScheduleExportPDFView.as_view(),
        name="schedule-pdf-export",
    ),
    path(
        "imports/preview/",
        ImportPreviewView.as_view(),
        name="import-preview",
    ),
    path(
        "imports/commit/",
        ImportCommitView.as_view(),
        name="import-commit",
    ),
    path(
        "imports/template/",
        TemplateView.as_view(),
        name="import-template",
    ),
    path(
        "imports/template/csv/",
        TemplateCSVView.as_view(),
        name="import-template-csv",
    ),
]