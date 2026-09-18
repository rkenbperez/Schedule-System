from django.urls import path

from .views import ScheduleExportView

urlpatterns = [
    path(
        "exports/schedules/<int:pk>.xlsx",
        ScheduleExportView.as_view(),
        name="schedule-export",
    ),
]