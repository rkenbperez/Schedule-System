from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/academics/', include('apps.academics.urls')),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/scheduling/', include('apps.scheduling.urls')),
    path('api/students/', include('apps.students.urls')),
]