from django.urls import path

from .views import StudentScheduleLookupView

urlpatterns = [
    path('schedule/', StudentScheduleLookupView.as_view(), name='student-schedule'),
]