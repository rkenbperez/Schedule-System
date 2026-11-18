from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from catalog.views import DepartmentViewSet, RoomViewSet, SectionViewSet, SubjectViewSet
from core.views import HealthView
from timetable.views import AssignmentViewSet, AvailabilityWindowViewSet, BusyBlockViewSet
from users.views import ProfessorsViewSet


router = DefaultRouter()
router.register("profs", ProfessorsViewSet, basename="prof")
router.register("rooms", RoomViewSet, basename="room")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("sections", SectionViewSet, basename="section")
router.register("departments", DepartmentViewSet, basename="department")
router.register("assignments", AssignmentViewSet, basename="assignment")
router.register(
    "availability-windows", AvailabilityWindowViewSet, basename="availability-window"
)
router.register("busy-blocks", BusyBlockViewSet, basename="busy-block")

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/", include("users.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("timetable.urls")),
    path("api/", include("data_transfer.urls")),  
    path("api/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]