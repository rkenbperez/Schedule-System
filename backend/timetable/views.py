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

from core.permissions import IsOwnerOrRegistrar, IsRegistrar, IsRegistrarOrReadOnly, IsProfessor, IsPublicReadOnly

from .engines import ALGORITHMS, run
from .models import AcademicTerm, Assignment, AvailabilityWindow, BusyBlock, ScheduledClass, ScheduleRun
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

    def perform_update(self, serializer):
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

    def perform_update(self, serializer):
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

        term = AcademicTerm.objects.filter(is_active=True).first()
        if term is None:
            return Response(
                {"error": "No active academic term found. Please set a term as active."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        scenario = build_scenario(term=term)
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
                breakdown=result.breakdown,
                created_by=request.user,
                term=term,
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
                        mode=pc.mode or None,
                        term=term,
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

        if request.user.is_staff:
            # Registrar sees all
            pass
        elif hasattr(request.user, "prof"):
            # Professor sees only their classes
            qs = qs.filter(assignment__prof__user=request.user)
        else:
            # Other authenticated users (future: student) see nothing by default
            qs = qs.none()

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
class ScheduleRunPublishedClassesView(APIView):
    """Public read-only access to published schedule run classes."""
    permission_classes = [IsPublicReadOnly]

    def get(self, request, pk):
        run_obj = get_object_or_404(ScheduleRun, pk=pk, published=True)
        qs = run_obj.classes.select_related(
            "assignment__prof", "assignment__subject", "assignment__section", "room"
        )
        return Response(ScheduledClassSerializer(qs, many=True).data)


@extend_schema(tags=["schedules"])
class ScheduleMyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        run_obj = ScheduleRun.objects.filter(term__is_active=True).order_by("-created_at").first()
        if run_obj is None:
            return Response([])

        if request.user.is_staff:
            # Registrar sees all classes in the active term run
            qs = run_obj.classes.select_related(
                "assignment__prof", "assignment__subject", "assignment__section", "room"
            )
        elif hasattr(request.user, "prof"):
            # Professor sees only their classes
            prof = request.user.prof
            qs = run_obj.classes.select_related(
                "assignment__prof", "assignment__subject", "assignment__section", "room"
            ).filter(assignment__prof=prof)
        else:
            return Response(
                {"error": "No professor profile linked to this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(ScheduledClassSerializer(qs, many=True).data)


# ==================== ADMIN PANEL APIs ====================

@extend_schema(tags=["admin"])
class AdminDashboardView(APIView):
    """Admin dashboard summary: counts, recent runs, conflicts."""
    permission_classes = [IsRegistrar]

    def get(self, request):
        from catalog.models import Department, Room, Section, Subject
        from users.models import Professors
        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta

        active_term = AcademicTerm.objects.filter(is_active=True).first()

        # Basic counts
        total_departments = Department.objects.count()
        total_rooms = Room.objects.count()
        total_sections = Section.objects.count()
        total_subjects = Subject.objects.count()
        total_professors = Professors.objects.count()
        total_assignments = Assignment.objects.count()
        total_runs = ScheduleRun.objects.count()

        # Active term specific counts
        if active_term:
            term_sections = Section.objects.filter(term=active_term).count()
            term_assignments = Assignment.objects.filter(term=active_term).count()
            term_runs = ScheduleRun.objects.filter(term=active_term).count()
        else:
            term_sections = term_assignments = term_runs = 0

        # Recent runs (last 10)
        recent_runs = ScheduleRun.objects.select_related("term", "created_by").order_by("-created_at")[:10]
        recent_runs_data = [
            {
                "id": r.id,
                "algorithm": r.algorithm,
                "status": r.status,
                "term": str(r.term) if r.term else None,
                "published": r.published,
                "runtime_ms": r.runtime_ms,
                "class_count": r.classes.count(),
                "created_by": r.created_by.username if r.created_by else None,
                "created_at": r.created_at,
            }
            for r in recent_runs
        ]

        # Conflict summary for latest feasible run
        latest_feasible_run = ScheduleRun.objects.filter(status=ScheduleRun.Status.FEASIBLE).order_by("-created_at").first()
        conflicts_count = 0
        if latest_feasible_run:
            conflicts_count = self._count_conflicts(latest_feasible_run)

        return Response({
            "counts": {
                "departments": total_departments,
                "rooms": total_rooms,
                "sections": total_sections,
                "subjects": total_subjects,
                "professors": total_professors,
                "assignments": total_assignments,
                "schedule_runs": total_runs,
            },
            "active_term": {
                "id": active_term.id if active_term else None,
                "name": str(active_term) if active_term else None,
                "code": active_term.code if active_term else None,
                "sections": term_sections,
                "assignments": term_assignments,
                "runs": term_runs,
            } if active_term else None,
            "recent_runs": recent_runs_data,
            "latest_feasible_run": {
                "id": latest_feasible_run.id,
                "conflicts": conflicts_count,
                "published": latest_feasible_run.published,
            } if latest_feasible_run else None,
        })

    def _count_conflicts(self, run_obj):
        """Count constraint violations in a schedule run."""
        classes = run_obj.classes.select_related(
            "assignment__prof", "assignment__subject", "assignment__section", "room"
        )
        conflicts = 0

        # Room double-booking
        room_bookings = {}
        for c in classes:
            key = (c.room_id, c.day, c.start_time, c.duration_slots)
            room_bookings[key] = room_bookings.get(key, 0) + 1
        conflicts += sum(1 for count in room_bookings.values() if count > 1)

        # Professor double-booking
        prof_bookings = {}
        for c in classes:
            key = (c.assignment.prof_id, c.day, c.start_time, c.duration_slots)
            prof_bookings[key] = prof_bookings.get(key, 0) + 1
        conflicts += sum(1 for count in prof_bookings.values() if count > 1)

        # Section double-booking
        section_bookings = {}
        for c in classes:
            key = (c.assignment.section_id, c.day, c.start_time, c.duration_slots)
            section_bookings[key] = section_bookings.get(key, 0) + 1
        conflicts += sum(1 for count in section_bookings.values() if count > 1)

        # Room capacity violations
        for c in classes:
            if c.room and c.assignment.section.headcount > c.room.capacity:
                conflicts += 1

        return conflicts


@extend_schema(tags=["admin"])
class AdminStatsView(APIView):
    """Detailed stats for charts and analytics."""
    permission_classes = [IsRegistrar]

    def get(self, request):
        from catalog.models import Department, Room, Section, Subject
        from users.models import Professors
        from django.db.models import Count, Avg

        active_term = AcademicTerm.objects.filter(is_active=True).first()

        # Runs by algorithm
        runs_by_algo = ScheduleRun.objects.values("algorithm").annotate(count=Count("id")).order_by("-count")

        # Runs by status
        runs_by_status = ScheduleRun.objects.values("status").annotate(count=Count("id")).order_by("-count")

        # Runs by term
        runs_by_term = ScheduleRun.objects.values("term__year", "term__semester").annotate(count=Count("id")).order_by("-term__year", "-term__semester")

        # Assignments by professor (top 10)
        assignments_by_prof = Assignment.objects.select_related("prof__user").values(
            "prof__user__username", "prof__user__first_name", "prof__user__last_name"
        ).annotate(count=Count("id")).order_by("-count")[:10]

        # Sections by program
        sections_by_program = Section.objects.values("program").annotate(count=Count("id")).order_by("-count")

        # Sections by year_level
        sections_by_year = Section.objects.values("year_level").annotate(count=Count("id")).order_by("year_level")

        # Room capacity distribution
        room_capacities = Room.objects.values("capacity").annotate(count=Count("id")).order_by("capacity")

        # Average runtime by algorithm
        avg_runtime = ScheduleRun.objects.filter(runtime_ms__gt=0).values("algorithm").annotate(avg_runtime=Avg("runtime_ms")).order_by("avg_runtime")

        return Response({
            "runs_by_algorithm": list(runs_by_algo),
            "runs_by_status": list(runs_by_status),
            "runs_by_term": list(runs_by_term),
            "assignments_by_professor": list(assignments_by_prof),
            "sections_by_program": list(sections_by_program),
            "sections_by_year_level": list(sections_by_year),
            "room_capacities": list(room_capacities),
            "avg_runtime_by_algorithm": list(avg_runtime),
            "active_term": active_term.code if active_term else None,
        })


@extend_schema(tags=["admin"])
class ScheduleRunConflictsView(APIView):
    """Get detailed constraint violations for a schedule run."""
    permission_classes = [IsRegistrar]

    def get(self, request, pk):
        run_obj = get_object_or_404(ScheduleRun, pk=pk)
        classes = run_obj.classes.select_related(
            "assignment__prof__user", "assignment__subject", "assignment__section", "room"
        ).order_by("day", "start_time")

        conflicts = {
            "room_conflicts": [],
            "professor_conflicts": [],
            "section_conflicts": [],
            "capacity_violations": [],
            "availability_violations": [],
            "consecutive_violations": [],
            "daily_hours_violations": [],
        }

        # Room double-booking
        room_bookings = {}
        for c in classes:
            key = (c.room_id, c.day, c.start_time, c.duration_slots)
            if key not in room_bookings:
                room_bookings[key] = []
            room_bookings[key].append(c)
        for key, bookings in room_bookings.items():
            if len(bookings) > 1:
                conflicts["room_conflicts"].append({
                    "room": bookings[0].room.name if bookings[0].room else "N/A",
                    "day": bookings[0].get_day_display(),
                    "start_time": bookings[0].start_time.strftime("%H:%M"),
                    "duration_slots": bookings[0].duration_slots,
                    "classes": [
                        {
                            "id": b.id,
                            "subject": b.assignment.subject.code,
                            "section": b.assignment.section.name,
                            "professor": b.assignment.prof.user.get_full_name() or b.assignment.prof.user.username,
                        }
                        for b in bookings
                    ]
                })

        # Professor double-booking
        prof_bookings = {}
        for c in classes:
            key = (c.assignment.prof_id, c.day, c.start_time, c.duration_slots)
            if key not in prof_bookings:
                prof_bookings[key] = []
            prof_bookings[key].append(c)
        for key, bookings in prof_bookings.items():
            if len(bookings) > 1:
                conflicts["professor_conflicts"].append({
                    "professor": bookings[0].assignment.prof.user.get_full_name() or bookings[0].assignment.prof.user.username,
                    "day": bookings[0].get_day_display(),
                    "start_time": bookings[0].start_time.strftime("%H:%M"),
                    "duration_slots": bookings[0].duration_slots,
                    "classes": [
                        {
                            "id": b.id,
                            "subject": b.assignment.subject.code,
                            "section": b.assignment.section.name,
                        }
                        for b in bookings
                    ]
                })

        # Section double-booking
        section_bookings = {}
        for c in classes:
            key = (c.assignment.section_id, c.day, c.start_time, c.duration_slots)
            if key not in section_bookings:
                section_bookings[key] = []
            section_bookings[key].append(c)
        for key, bookings in section_bookings.items():
            if len(bookings) > 1:
                conflicts["section_conflicts"].append({
                    "section": bookings[0].assignment.section.name,
                    "day": bookings[0].get_day_display(),
                    "start_time": bookings[0].start_time.strftime("%H:%M"),
                    "duration_slots": bookings[0].duration_slots,
                    "classes": [
                        {
                            "id": b.id,
                            "subject": b.assignment.subject.code,
                            "professor": b.assignment.prof.user.get_full_name() or b.assignment.prof.user.username,
                        }
                        for b in bookings
                    ]
                })

        # Room capacity violations
        for c in classes:
            if c.room and c.assignment.section.headcount > c.room.capacity:
                conflicts["capacity_violations"].append({
                    "class_id": c.id,
                    "room": c.room.name,
                    "capacity": c.room.capacity,
                    "headcount": c.assignment.section.headcount,
                    "subject": c.assignment.subject.code,
                    "section": c.assignment.section.name,
                })

        # Professor availability violations
        from timetable.models import AvailabilityWindow
        availability_map = {}
        for aw in AvailabilityWindow.objects.all():
            key = (aw.prof_id, aw.day)
            if key not in availability_map:
                availability_map[key] = []
            availability_map[key].append((aw.start_time, aw.end_time))

        for c in classes:
            prof_id = c.assignment.prof_id
            day = c.day
            class_start = c.start_time
            class_end = c.end_time
            key = (prof_id, day)
            if key in availability_map:
                available = False
                for start, end in availability_map[key]:
                    if start <= class_start and class_end <= end:
                        available = True
                        break
                if not available:
                    conflicts["availability_violations"].append({
                        "class_id": c.id,
                        "professor": c.assignment.prof.user.get_full_name() or c.assignment.prof.user.username,
                        "day": c.get_day_display(),
                        "class_time": f"{class_start.strftime('%H:%M')}-{class_end.strftime('%H:%M')}",
                        "available_windows": [
                            f"{s.strftime('%H:%M')}-{e.strftime('%H:%M')}" for s, e in availability_map[key]
                        ],
                    })

        # Consecutive hours violations (per professor per day)
        from collections import defaultdict
        prof_day_classes = defaultdict(list)
        for c in classes:
            prof_day_classes[(c.assignment.prof_id, c.day)].append(c)

        for (prof_id, day), day_classes in prof_day_classes.items():
            day_classes.sort(key=lambda x: x.start_time)
            prof = day_classes[0].assignment.prof
            max_consecutive = prof.max_consecutive
            for i in range(len(day_classes)):
                current = day_classes[i]
                current_end = current.end_time
                consecutive_slots = current.duration_slots
                for j in range(i + 1, len(day_classes)):
                    next_class = day_classes[j]
                    if next_class.start_time == current_end:
                        consecutive_slots += next_class.duration_slots
                        current_end = next_class.end_time
                    else:
                        break
                if consecutive_slots > max_consecutive:
                    conflicts["consecutive_violations"].append({
                        "professor": prof.user.get_full_name() or prof.user.username,
                        "day": day_classes[0].get_day_display(),
                        "max_consecutive": max_consecutive,
                        "actual_consecutive": consecutive_slots,
                        "classes": [
                            {
                                "id": c.id,
                                "subject": c.assignment.subject.code,
                                "start": c.start_time.strftime("%H:%M"),
                                "end": c.end_time.strftime("%H:%M"),
                            }
                            for c in day_classes[i:i+3]
                        ]
                    })
                    break  # Report first violation per professor per day

        # Daily hours violations
        for (prof_id, day), day_classes in prof_day_classes.items():
            prof = day_classes[0].assignment.prof
            max_daily = prof.max_daily_hours
            total_slots = sum(c.duration_slots for c in day_classes)
            if total_slots > max_daily:
                conflicts["daily_hours_violations"].append({
                    "professor": prof.user.get_full_name() or prof.user.username,
                    "day": day_classes[0].get_day_display(),
                    "max_daily_hours": max_daily,
                    "actual_hours": total_slots,
                    "classes": [
                        {
                            "id": c.id,
                            "subject": c.assignment.subject.code,
                            "start": c.start_time.strftime("%H:%M"),
                            "end": c.end_time.strftime("%H:%M"),
                        }
                        for c in day_classes
                    ]
                })

        return Response(conflicts)


@extend_schema(
    tags=["admin"],
    request=inline_serializer(
        name="PublishScheduleRequest",
        fields={
            "published": serializers.BooleanField(),
        },
    ),
    responses={
        200: OpenApiResponse(description="Schedule publish status updated"),
        404: OpenApiResponse(description="Schedule run not found"),
    },
)
class ScheduleRunPublishView(APIView):
    """Publish or unpublish a schedule run."""
    permission_classes = [IsRegistrar]

    def patch(self, request, pk):
        run_obj = get_object_or_404(ScheduleRun, pk=pk)
        published = request.data.get("published")
        if published is None:
            return Response(
                {"error": "published field is required (true/false)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        run_obj.published = bool(published)
        run_obj.save(update_fields=["published"])
        return Response({
            "id": run_obj.id,
            "published": run_obj.published,
            "message": f"Schedule run {'published' if published else 'unpublished'} successfully",
        })


@extend_schema(
    tags=["admin"],
    request=inline_serializer(
        name="BulkCreateSectionsRequest",
        fields={
            "sections": serializers.ListField(
                child=inline_serializer(
                    name="SectionInput",
                    fields={
                        "name": serializers.CharField(max_length=50),
                        "headcount": serializers.IntegerField(min_value=1),
                        "program": serializers.CharField(max_length=20, required=False, default=""),
                        "year_level": serializers.IntegerField(min_value=1, max_value=6, required=False, default=1),
                        "term": serializers.IntegerField(required=False),
                    },
                ),
            ),
        },
    ),
    responses={
        201: OpenApiResponse(description="Sections created"),
        400: OpenApiResponse(description="Validation errors"),
    },
)
class BulkCreateSectionsView(APIView):
    """Bulk create sections."""
    permission_classes = [IsRegistrar]

    def post(self, request):
        sections_data = request.data.get("sections", [])
        if not sections_data:
            return Response(
                {"error": "sections list is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_term = AcademicTerm.objects.filter(is_active=True).first()
        created = []
        errors = []

        for idx, data in enumerate(sections_data):
            try:
                term_id = data.get("term", active_term.id if active_term else None)
                if not term_id:
                    errors.append({"index": idx, "error": "term is required and no active term found"})
                    continue

                term = AcademicTerm.objects.get(pk=term_id)
                section = Section.objects.create(
                    name=data["name"],
                    headcount=data["headcount"],
                    program=data.get("program", ""),
                    year_level=data.get("year_level", 1),
                    term=term,
                )
                created.append({
                    "id": section.id,
                    "name": section.name,
                    "headcount": section.headcount,
                    "program": section.program,
                    "year_level": section.year_level,
                    "term": str(section.term),
                })
            except Exception as e:
                errors.append({"index": idx, "error": str(e)})

        return Response({
            "created": created,
            "errors": errors,
            "created_count": len(created),
            "error_count": len(errors),
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=["admin"],
    request=inline_serializer(
        name="BulkCreateAssignmentsRequest",
        fields={
            "assignments": serializers.ListField(
                child=inline_serializer(
                    name="AssignmentInput",
                    fields={
                        "prof": serializers.IntegerField(),
                        "subject": serializers.IntegerField(),
                        "section": serializers.IntegerField(),
                        "term": serializers.IntegerField(required=False),
                        "meetings": serializers.ListField(
                            child=inline_serializer(
                                name="MeetingInput",
                                fields={
                                    "mode": serializers.ChoiceField(choices=["async", "sync", "lab"]),
                                    "duration_slots": serializers.IntegerField(min_value=1, required=False),
                                },
                            ),
                            required=False,
                        ),
                    },
                ),
            ),
        },
    ),
    responses={
        201: OpenApiResponse(description="Assignments created"),
        400: OpenApiResponse(description="Validation errors"),
    },
)
class BulkCreateAssignmentsView(APIView):
    """Bulk create assignments with meetings."""
    permission_classes = [IsRegistrar]

    def post(self, request):
        assignments_data = request.data.get("assignments", [])
        if not assignments_data:
            return Response(
                {"error": "assignments list is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_term = AcademicTerm.objects.filter(is_active=True).first()
        created = []
        errors = []

        for idx, data in enumerate(assignments_data):
            try:
                term_id = data.get("term", active_term.id if active_term else None)
                if not term_id:
                    errors.append({"index": idx, "error": "term is required and no active term found"})
                    continue

                term = AcademicTerm.objects.get(pk=term_id)
                assignment = Assignment.objects.create(
                    prof_id=data["prof"],
                    subject_id=data["subject"],
                    section_id=data["section"],
                    term=term,
                )

                meetings_data = data.get("meetings", [])
                if not meetings_data:
                    meetings_data = [{"mode": "sync", "duration_slots": 2}]

                for order, m_data in enumerate(meetings_data, start=1):
                    MeetingSlot.objects.create(
                        assignment=assignment,
                        order=order,
                        mode=m_data.get("mode", "sync"),
                        duration_slots=m_data.get("duration_slots", {"sync": 2, "async": 1, "lab": 3}.get(m_data.get("mode", "sync"), 1)),
                    )

                created.append({
                    "id": assignment.id,
                    "prof": assignment.prof_id,
                    "subject": assignment.subject_id,
                    "section": assignment.section_id,
                    "term": str(assignment.term),
                    "meetings": [
                        {"order": m.order, "mode": m.mode, "duration_slots": m.duration_slots}
                        for m in assignment.meetings.all()
                    ],
                })
            except Exception as e:
                errors.append({"index": idx, "error": str(e)})

        return Response({
            "created": created,
            "errors": errors,
            "created_count": len(created),
            "error_count": len(errors),
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)
