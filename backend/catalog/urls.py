from django.urls import path

from .views import AcademicTermsView

urlpatterns = [
    path("academics/terms/", AcademicTermsView.as_view(), name="academic-terms"),
]
