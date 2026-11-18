from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .analytics.views import (
    AnalyticsOverviewView,
    AnalyticsQualityView,
    AnalyticsRoomsView,
    AnalyticsSectionsView,
    AnalyticsWorkloadView,
)
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
    ProfessorProfileView,
    ProfessorScheduleView,
    ProfessorScheduleConflictsView,
    ProfessorAvailabilityViewSet,
    ProfessorBusyBlockViewSet,
    PublicTermsView,
    PublicTermScheduleView,
    PublicTermSectionsView,
    PublicSectionScheduleView,
    AuditLogListView,
    GlobalSettingsView,
    GlobalSettingDetailView,
    ConflictResolutionListView,
    ConflictResolutionResolveView,
    ConflictResolutionIgnoreView,
)

router = DefaultRouter()
router.register("professor/availability", ProfessorAvailabilityViewSet, basename="professor-availability")
router.register("professor/busy-blocks", ProfessorBusyBlockViewSet, basename="professor-busy-blocks")

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
    path("admin/analytics/overview/", AnalyticsOverviewView.as_view(), name="analytics-overview"),
    path("admin/analytics/quality/", AnalyticsQualityView.as_view(), name="analytics-quality"),
    path("admin/analytics/workload/", AnalyticsWorkloadView.as_view(), name="analytics-workload"),
    path("admin/analytics/rooms/", AnalyticsRoomsView.as_view(), name="analytics-rooms"),
    path("admin/analytics/sections/", AnalyticsSectionsView.as_view(), name="analytics-sections"),
    path("admin/schedules/runs/<int:pk>/conflicts/", ScheduleRunConflictsView.as_view(), name="schedule-run-conflicts"),
    path("admin/schedules/runs/<int:pk>/publish/", ScheduleRunPublishView.as_view(), name="schedule-run-publish"),
    path("admin/sections/bulk/", BulkCreateSectionsView.as_view(), name="bulk-create-sections"),
    path("admin/assignments/bulk/", BulkCreateAssignmentsView.as_view(), name="bulk-create-assignments"),
    # Professor Panel APIs
    path("professor/me/", ProfessorProfileView.as_view(), name="professor-profile"),
    path("professor/me/schedule/", ProfessorScheduleView.as_view(), name="professor-schedule"),
    path("professor/me/schedule/conflicts/", ProfessorScheduleConflictsView.as_view(), name="professor-schedule-conflicts"),
    # Public Schedule APIs
    path("public/schedules/", PublicTermsView.as_view(), name="public-terms"),
    path("public/schedules/<str:term_code>/", PublicTermScheduleView.as_view(), name="public-term-schedule"),
    path("public/schedules/<str:term_code>/sections/", PublicTermSectionsView.as_view(), name="public-term-sections"),
    path("public/schedules/<str:term_code>/sections/<int:section_id>/", PublicSectionScheduleView.as_view(), name="public-section-schedule"),
    # Advanced Features
    path("audit/", AuditLogListView.as_view(), name="audit-log"),
    path("settings/", GlobalSettingsView.as_view(), name="global-settings"),
    path("settings/<str:key>/", GlobalSettingDetailView.as_view(), name="global-setting-detail"),
    path("admin/schedules/runs/<int:run_id>/conflict-resolutions/", ConflictResolutionListView.as_view(), name="conflict-resolutions"),
    path("admin/conflict-resolutions/<int:pk>/resolve/", ConflictResolutionResolveView.as_view(), name="conflict-resolution-resolve"),
    path("admin/conflict-resolutions/<int:pk>/ignore/", ConflictResolutionIgnoreView.as_view(), name="conflict-resolution-ignore"),
] + router.urls
