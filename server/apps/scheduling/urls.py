from rest_framework.routers import DefaultRouter

from .views import CourseAssignmentViewSet, ScheduleViewSet

router = DefaultRouter()
router.register('assignments', CourseAssignmentViewSet, basename='assignment')
router.register('schedules', ScheduleViewSet, basename='schedule')

urlpatterns = router.urls