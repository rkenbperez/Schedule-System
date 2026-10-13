from django.urls import path

from .views import (
    ScheduleGenerateView,
    ScheduleMyView,
    ScheduleRunClassesView,
    ScheduleRunDetailView,
    ScheduleRunListView,
    ScheduleRunPublishedClassesView,
)

urlpatterns = [
    path("schedules/generate", ScheduleGenerateView.as_view(), name="schedule-generate"),
    path("schedules/runs", ScheduleRunListView.as_view(), name="schedule-run-list"),
    path("schedules/runs/<int:pk>", ScheduleRunDetailView.as_view(), name="schedule-run-detail"),
    path(
        "schedules/runs/<int:pk>/classes",
        ScheduleRunClassesView.as_view(),
        name="schedule-run-classes",
    ),
    path(
        "schedules/runs/<int:pk>/classes/published",
        ScheduleRunPublishedClassesView.as_view(),
        name="schedule-run-classes-published",
    ),
    path("schedules/my", ScheduleMyView.as_view(), name="schedule-my"),
]
