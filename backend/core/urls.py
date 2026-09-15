"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from catalog.views import DepartmentViewSet, RoomViewSet, SectionViewSet, SubjectViewSet
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
    path("api/", include("users.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("timetable.urls")),
    path("api/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
