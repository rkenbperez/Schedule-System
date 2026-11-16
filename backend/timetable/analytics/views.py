from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsRegistrar
from timetable.models import ScheduleRun

from . import metrics
from .filters import (
    parse_date_range,
    parse_optional_int,
    parse_pagination,
    resolve_context,
)


TERM_RUN_PARAMETERS = [
    OpenApiParameter(
        "term",
        str,
        description="Term ID or YYYY-S code. Defaults to the active term.",
    ),
    OpenApiParameter(
        "run",
        int,
        description="Schedule run ID. Defaults to latest published, then latest feasible.",
    ),
]

LIST_PARAMETERS = [
    OpenApiParameter("limit", int, description="Page size, 1-200. Default 50."),
    OpenApiParameter("offset", int, description="Zero-based result offset."),
]


class AnalyticsBaseView(APIView):
    permission_classes = [IsRegistrar]

    def context(self, request):
        return resolve_context(request.query_params)

    def response(self, request, context, summary, data, pagination=None, class_count=None):
        meta = metrics.context_meta(context, class_count=class_count)
        if pagination is not None:
            meta["pagination"] = pagination
        return Response({"meta": meta, "summary": summary, "data": data})


@extend_schema(tags=["analytics"], parameters=TERM_RUN_PARAMETERS)
class AnalyticsOverviewView(AnalyticsBaseView):
    def get(self, request):
        context = self.context(request)
        result = metrics.build_overview(context)
        class_count = None
        if result["summary"]["quality"] is not None:
            class_count = result["summary"]["quality"]["class_count"]
        return self.response(
            request,
            context,
            result["summary"],
            result["data"],
            class_count=class_count,
        )


@extend_schema(
    tags=["analytics"],
    parameters=TERM_RUN_PARAMETERS
    + LIST_PARAMETERS
    + [
        OpenApiParameter("algorithm", str),
        OpenApiParameter("status", str),
        OpenApiParameter("from", str, description="Run date lower bound, YYYY-MM-DD."),
        OpenApiParameter("to", str, description="Run date upper bound, YYYY-MM-DD."),
    ],
)
class AnalyticsQualityView(AnalyticsBaseView):
    def get(self, request):
        context = self.context(request)
        limit, offset = parse_pagination(request.query_params)
        date_from, date_to = parse_date_range(request.query_params)
        status_filter = request.query_params.get("status")
        if status_filter and status_filter not in ScheduleRun.Status.values:
            raise ValidationError(
                {"status": f"Choose one of {ScheduleRun.Status.values}."}
            )
        result = metrics.build_quality(
            context.term,
            context.run,
            algorithm=request.query_params.get("algorithm"),
            status=status_filter,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
        return self.response(
            request,
            context,
            result["summary"],
            {
                "runs": result["runs"],
                "by_algorithm": result["by_algorithm"],
            },
            pagination=result["pagination"],
        )


@extend_schema(
    tags=["analytics"],
    parameters=TERM_RUN_PARAMETERS
    + LIST_PARAMETERS
    + [OpenApiParameter("department", int)],
)
class AnalyticsWorkloadView(AnalyticsBaseView):
    def get(self, request):
        context = self.context(request)
        limit, offset = parse_pagination(request.query_params)
        department_id = parse_optional_int(request.query_params, "department")
        result = metrics.build_workload(
            context.term, context.run, department_id=department_id
        )
        rows = result["professors"]
        return self.response(
            request,
            context,
            result["summary"],
            {"professors": rows[offset : offset + limit]},
            pagination={"total": len(rows), "limit": limit, "offset": offset},
        )


@extend_schema(
    tags=["analytics"],
    parameters=TERM_RUN_PARAMETERS
    + LIST_PARAMETERS
    + [
        OpenApiParameter("building", str),
        OpenApiParameter("department", int),
    ],
)
class AnalyticsRoomsView(AnalyticsBaseView):
    def get(self, request):
        context = self.context(request)
        limit, offset = parse_pagination(request.query_params)
        department_id = parse_optional_int(request.query_params, "department")
        result = metrics.build_rooms(
            context.run,
            building=request.query_params.get("building"),
            department_id=department_id,
        )
        rows = result["rooms"]
        return self.response(
            request,
            context,
            result["summary"],
            {
                "rooms": rows[offset : offset + limit],
                "heatmap": result["heatmap"],
            },
            pagination={"total": len(rows), "limit": limit, "offset": offset},
        )


@extend_schema(
    tags=["analytics"],
    parameters=TERM_RUN_PARAMETERS
    + LIST_PARAMETERS
    + [OpenApiParameter("program", str)],
)
class AnalyticsSectionsView(AnalyticsBaseView):
    def get(self, request):
        context = self.context(request)
        limit, offset = parse_pagination(request.query_params)
        result = metrics.build_sections(
            context.term,
            context.run,
            program=request.query_params.get("program"),
        )
        rows = result["sections"]
        return self.response(
            request,
            context,
            result["summary"],
            {"sections": rows[offset : offset + limit]},
            pagination={"total": len(rows), "limit": limit, "offset": offset},
        )
