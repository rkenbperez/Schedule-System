from django.urls import path

from .views import ScheduleExportView, SchedulePdfExportView

urlpatterns = [
    path(
        "exports/schedules/<int:pk>.xlsx",
        ScheduleExportView.as_view(),
        name="schedule-export",
    ),
    path(
        "exports/schedules/<int:pk>.pdf",
        SchedulePdfExportView.as_view(),
        name="schedule-pdf-export",
    ),
]