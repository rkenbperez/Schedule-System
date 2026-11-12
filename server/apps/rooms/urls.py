from rest_framework.routers import DefaultRouter

from .views import RoomTypeViewSet, RoomViewSet

router = DefaultRouter()
router.register('room-types', RoomTypeViewSet, basename='room-type')
router.register('rooms', RoomViewSet, basename='room')

urlpatterns = router.urls