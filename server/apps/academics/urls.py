from rest_framework.routers import DefaultRouter

from .views import AcademicTermViewSet, CourseComponentViewSet, CourseViewSet, SectionViewSet

router = DefaultRouter()
router.register('terms', AcademicTermViewSet, basename='term')
router.register('courses', CourseViewSet, basename='course')
router.register('course-components', CourseComponentViewSet, basename='course-component')
router.register('sections', SectionViewSet, basename='section')

urlpatterns = router.urls