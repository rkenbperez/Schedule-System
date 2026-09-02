from rest_framework.routers import DefaultRouter

from .views import RoomViewSet, SectionViewSet, SubjectViewSet

router = DefaultRouter()
router.register("rooms", RoomViewSet, basename="room")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("sections", SectionViewSet, basename="section")

urlpatterns = router.urls
