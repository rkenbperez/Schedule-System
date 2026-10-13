from django.urls import path

from .views import (
    ScheduleGenerateView,
    ScheduleMyView,
    ScheduleRunClassesView,
    ScheduleRunDetailView,
    ScheduleRunListView,
    ScheduleRunPublishedClassesView,
    AdminDashboardView,
    AdminStatsView,
    ScheduleRunConflictsView,
    ScheduleRunPublishView,
    BulkCreateSectionsView,
    BulkCreateAssignmentsView,
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
    # Admin Panel APIs
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("admin/schedules/runs/<int:pk>/conflicts/", ScheduleRunConflictsView.as_view(), name="schedule-run-conflicts"),
    path("admin/schedules/runs/<int:pk>/publish/", ScheduleRunPublishView.as_view(), name="schedule-run-publish"),
    path("admin/sections/bulk/", BulkCreateSectionsView.as_view(), name="bulk-create-sections"),
    path("admin/assignments/bulk/", BulkCreateAssignmentsView.as_view(), name="bulk-create-assignments"),
]
