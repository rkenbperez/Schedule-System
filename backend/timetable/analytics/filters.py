from dataclasses import dataclass
from datetime import date

from rest_framework.exceptions import ValidationError

from timetable.models import AcademicTerm, ScheduleRun


@dataclass(frozen=True)
class AnalyticsContext:
    term: AcademicTerm | None
    run: ScheduleRun | None
    selection: str


def _parse_int(raw, name):
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ValidationError({name: f"'{name}' must be an integer."})


def _resolve_term(raw):
    if raw.isdigit():
        term = AcademicTerm.objects.filter(pk=int(raw)).first()
    else:
        parts = raw.split("-")
        if len(parts) != 2 or not all(part.isdigit() for part in parts):
            raise ValidationError(
                {"term": "Use a term ID or code in 'YYYY-S' format."}
            )
        year, semester = int(parts[0]), int(parts[1])
        term = AcademicTerm.objects.filter(year=year, semester=semester).first()
    if term is None:
        raise ValidationError({"term": "Term not found."})
    return term


def _resolve_run(raw):
    run_id = _parse_int(raw, "run")
    run = (
        ScheduleRun.objects.select_related("term", "created_by")
        .filter(pk=run_id)
        .first()
    )
    if run is None:
        raise ValidationError({"run": "Schedule run not found."})
    return run


def _select_run(term):
    runs = ScheduleRun.objects.select_related("term", "created_by")
    if term is not None:
        runs = runs.filter(term=term)
    for selection, filters in (
        ("latest_published", {"published": True}),
        ("latest_feasible", {"status": ScheduleRun.Status.FEASIBLE}),
        ("latest", {}),
    ):
        run = runs.filter(**filters).order_by("-created_at", "-id").first()
        if run is not None:
            return run, selection
    return None, "none"


def resolve_context(query_params):
    term_param = query_params.get("term")
    run_param = query_params.get("run")

    term = _resolve_term(term_param) if term_param else None
    run = _resolve_run(run_param) if run_param else None

    if term is not None and run is not None and run.term_id is not None:
        if run.term_id != term.id:
            raise ValidationError(
                {"run": "The selected run does not belong to the selected term."}
            )

    if term is None and run is not None:
        term = run.term
    if term is None:
        term = AcademicTerm.objects.filter(is_active=True).first()

    if run is not None:
        return AnalyticsContext(term=term, run=run, selection="explicit")

    run, selection = _select_run(term)
    if term is None and run is not None:
        term = run.term
    return AnalyticsContext(term=term, run=run, selection=selection)


def parse_pagination(query_params, default=50, maximum=200):
    raw_limit = query_params.get("limit")
    raw_offset = query_params.get("offset")

    limit = default if raw_limit is None else _parse_int(raw_limit, "limit")
    offset = 0 if raw_offset is None else _parse_int(raw_offset, "offset")

    if limit < 1 or limit > maximum:
        raise ValidationError({"limit": f"'limit' must be between 1 and {maximum}."})
    if offset < 0:
        raise ValidationError({"offset": "'offset' must be zero or greater."})
    return limit, offset


def parse_optional_int(query_params, key):
    raw = query_params.get(key)
    if raw in (None, ""):
        return None
    return _parse_int(raw, key)


def parse_date_range(query_params):
    parsed = {}
    for key in ("from", "to"):
        raw = query_params.get(key)
        if raw in (None, ""):
            parsed[key] = None
            continue
        try:
            parsed[key] = date.fromisoformat(raw)
        except ValueError:
            raise ValidationError({key: "Use an ISO date in YYYY-MM-DD format."})
    if parsed["from"] and parsed["to"] and parsed["from"] > parsed["to"]:
        raise ValidationError({"to": "'to' must be on or after 'from'."})
    return parsed["from"], parsed["to"]
