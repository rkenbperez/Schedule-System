from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LoginView, ProfessorsViewSet

router = DefaultRouter()
router.register("profs", ProfessorsViewSet, basename="prof")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
]

urlpatterns += router.urls
