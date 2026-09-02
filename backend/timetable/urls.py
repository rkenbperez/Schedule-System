from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AssignmentViewSet,
    AvailabilityWindowViewSet,
    BusyBlockViewSet,
    ScheduleGenerateView,
    ScheduleMyView,
    ScheduleRunClassesView,
    ScheduleRunDetailView,
    ScheduleRunListView,
)

router = DefaultRouter()
router.register("assignments", AssignmentViewSet, basename="assignment")
router.register("availability-windows", AvailabilityWindowViewSet, basename="availability-window")
router.register("busy-blocks", BusyBlockViewSet, basename="busy-block")

urlpatterns = [
    path("schedules/generate", ScheduleGenerateView.as_view(), name="schedule-generate"),
    path("schedules/runs", ScheduleRunListView.as_view(), name="schedule-run-list"),
    path("schedules/runs/<int:pk>", ScheduleRunDetailView.as_view(), name="schedule-run-detail"),
    path(
        "schedules/runs/<int:pk>/classes",
        ScheduleRunClassesView.as_view(),
        name="schedule-run-classes",
    ),
    path("schedules/my", ScheduleMyView.as_view(), name="schedule-my"),
]

urlpatterns += router.urls
