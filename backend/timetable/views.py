from datetime import time as dtime

from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets

from core.permissions import IsOwnerOrRegistrar, IsRegistrar, IsRegistrarOrReadOnly

from .engines import ALGORITHMS, run
from .models import Assignment, AvailabilityWindow, BusyBlock, ScheduledClass, ScheduleRun
from .scenario_builder import build_scenario
from .serializers import (
    AssignmentSerializer,
    AvailabilityWindowSerializer,
    BusyBlockSerializer,
    ScheduledClassSerializer,
    ScheduleRunSerializer,
)


@extend_schema_view(
    list=extend_schema(tags=["timetable"]),
    retrieve=extend_schema(tags=["timetable"]),
    create=extend_schema(tags=["timetable"]),
    update=extend_schema(tags=["timetable"]),
    partial_update=extend_schema(tags=["timetable"]),
    destroy=extend_schema(tags=["timetable"]),
)
class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related("prof", "subject", "section").all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsRegistrarOrReadOnly]


@extend_schema_view(
    list=extend_schema(tags=["timetable"]),
    retrieve=extend_schema(tags=["timetable"]),
    create=extend_schema(tags=["timetable"]),
    update=extend_schema(tags=["timetable"]),
    partial_update=extend_schema(tags=["timetable"]),
    destroy=extend_schema(tags=["timetable"]),
)
class AvailabilityWindowViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilityWindowSerializer
    permission_classes = [IsOwnerOrRegistrar]

    def get_queryset(self):
        qs = AvailabilityWindow.objects.select_related("prof")
        if self.request.user.is_staff:
            return qs
        return qs.filter(prof__user=self.request.user)

    def perform_create(self, serializer):
        prof = self._own_prof()
        if prof is None:
            serializer.save()
        else:
            serializer.save(prof=prof)

    def _own_prof(self):
        if self.request.user.is_staff:
            return None
        prof = getattr(self.request.user, "prof", None)
        if prof is None:
            raise PermissionDenied("No professor profile linked to this account.")
        return prof


@extend_schema_view(
    list=extend_schema(tags=["timetable"]),
    retrieve=extend_schema(tags=["timetable"]),
    create=extend_schema(tags=["timetable"]),
    update=extend_schema(tags=["timetable"]),
    partial_update=extend_schema(tags=["timetable"]),
    destroy=extend_schema(tags=["timetable"]),
)
class BusyBlockViewSet(viewsets.ModelViewSet):
    serializer_class = BusyBlockSerializer
    permission_classes = [IsOwnerOrRegistrar]

    def get_queryset(self):
        qs = BusyBlock.objects.select_related("prof")
        if self.request.user.is_staff:
            return qs
        return qs.filter(prof__user=self.request.user)

    def perform_create(self, serializer):
        prof = self._own_prof()
        if prof is None:
            serializer.save()
        else:
            serializer.save(prof=prof)

    def _own_prof(self):
        if self.request.user.is_staff:
            return None
        prof = getattr(self.request.user, "prof", None)
        if prof is None:
            raise PermissionDenied("No professor profile linked to this account.")
        return prof


@extend_schema(
    tags=["schedules"],
    request=inline_serializer(
        name="ScheduleGenerateRequest",
        fields={
            "algorithm": serializers.CharField(),
            "time_limit_s": serializers.FloatField(required=False),
        },
    ),
    responses={
        201: OpenApiResponse(description="Schedule generated and persisted"),
        400: OpenApiResponse(description="Invalid algorithm or time limit"),
    },
)
class ScheduleGenerateView(APIView):
    permission_classes = [IsRegistrar]

    def post(self, request):
        algorithm = request.data.get("algorithm")
        if algorithm not in ALGORITHMS:
            return Response(
                {
                    "error": (
                        f"Unknown algorithm '{algorithm}'. "
                        f"Choose from {sorted(ALGORITHMS)}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        time_limit = request.data.get("time_limit_s", 30)
        try:
            time_limit = float(time_limit)
        except (TypeError, ValueError):
            return Response(
                {"error": "time_limit_s must be a number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        scenario = build_scenario()
        result = run(algorithm, scenario, time_limit_s=time_limit)

        with transaction.atomic():
            run_obj = ScheduleRun.objects.create(
                algorithm=algorithm,
                status=(
                    ScheduleRun.Status.FEASIBLE
                    if result.feasible
                    else ScheduleRun.Status.INFEASIBLE
                ),
                runtime_ms=result.runtime_ms,
                soft_score=result.soft_score,
                created_by=request.user,
            )

            ScheduledClass.objects.bulk_create(
                [
                    ScheduledClass(
                        run=run_obj,
                        assignment_id=pc.assignment_id,
                        room_id=pc.room_id,
                        day=pc.day,
                        start_time=dtime(pc.start // 60, pc.start % 60),
                        duration_slots=pc.duration_slots,
                    )
                    for pc in result.classes
                ]
            )

        return Response(
            {
                "run_id": run_obj.id,
                "algorithm": algorithm,
                "status": run_obj.status,
                "feasible": result.feasible,
                "runtime_ms": result.runtime_ms,
                "soft_score": result.soft_score,
                "class_count": len(result.classes),
                "violations": result.violations,
                "unplaced": result.unplaced,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["schedules"])
class ScheduleRunListView(ListAPIView):
    permission_classes = [IsRegistrar]
    queryset = ScheduleRun.objects.prefetch_related("classes").all()
    serializer_class = ScheduleRunSerializer


@extend_schema(tags=["schedules"])
class ScheduleRunDetailView(RetrieveAPIView):
    permission_classes = [IsRegistrar]
    queryset = ScheduleRun.objects.prefetch_related("classes").all()
    serializer_class = ScheduleRunSerializer


@extend_schema(tags=["schedules"])
class ScheduleRunClassesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        run_obj = get_object_or_404(ScheduleRun, pk=pk)
        qs = run_obj.classes.select_related(
            "assignment__prof", "assignment__subject", "assignment__section", "room"
        )

        if not request.user.is_staff:
            qs = qs.filter(assignment__prof__user=request.user)

        params = request.query_params
        if params.get("prof"):
            qs = qs.filter(assignment__prof_id=self._int_param("prof", params["prof"]))
        if params.get("section"):
            qs = qs.filter(assignment__section_id=self._int_param("section", params["section"]))
        if params.get("room"):
            qs = qs.filter(room_id=self._int_param("room", params["room"]))
        if params.get("day"):
            qs = qs.filter(day=self._int_param("day", params["day"]))

        return Response(ScheduledClassSerializer(qs, many=True).data)

    def _int_param(self, name, raw):
        try:
            return int(raw)
        except (TypeError, ValueError):
            raise ValidationError({"detail": f"'{name}' must be an integer."})


@extend_schema(tags=["schedules"])
class ScheduleMyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        run_obj = ScheduleRun.objects.order_by("-created_at").first()
        if run_obj is None:
            return Response([])

        qs = run_obj.classes.select_related(
            "assignment__prof", "assignment__subject", "assignment__section", "room"
        )
        if not request.user.is_staff:
            prof = getattr(request.user, "prof", None)
            if prof is None:
                return Response(
                    {"error": "No professor profile linked to this account."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = qs.filter(assignment__prof=prof)

        return Response(ScheduledClassSerializer(qs, many=True).data)
