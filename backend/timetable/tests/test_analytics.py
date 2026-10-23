from datetime import time

from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from timetable.models import AcademicTerm, MeetingSlot, ScheduledClass, ScheduleRun
from timetable.tests.factories import (
    AcademicTermFactory,
    AssignmentFactory,
    ProfessorUserFactory,
    RoomFactory,
    ScheduleRunFactory,
    SectionFactory,
    SubjectFactory,
)


class AnalyticsTestCase(APITestCase):
    def setUp(self):
        self.registrar = ProfessorUserFactory(is_staff=True)
        self.registrar_token = Token.objects.create(user=self.registrar)
        self.other_user = ProfessorUserFactory()
        self.other_token = Token.objects.create(user=self.other_user)

        self.term = AcademicTermFactory(
            year=2026, semester=1, is_active=True
        )
        self.section = SectionFactory(
            term=self.term, name="BSIT-1A", program="BSIT"
        )
        self.room = RoomFactory(name="R-101", capacity=40, building="Main")
        assignment = AssignmentFactory(
            section=self.section,
            term=self.term,
            subject=SubjectFactory(code="CS101"),
        )
        self.assignment = assignment
        MeetingSlot.objects.create(
            assignment=assignment,
            order=1,
            mode="sync",
            duration_slots=2,
        )
        self.run = ScheduleRunFactory(
            term=self.term,
            published=True,
            soft_score=10,
            runtime_ms=500,
        )
        self.scheduled_class = ScheduledClass.objects.create(
            run=self.run,
            assignment=assignment,
            room=self.room,
            day=0,
            start_time=time(8, 0),
            duration_slots=2,
            mode="sync",
            term=self.term,
        )

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def get(self, path, token=None):
        self.auth(token or self.registrar_token)
        return self.client.get(path)


class AnalyticsPermissionTests(AnalyticsTestCase):
    def test_anonymous_is_rejected(self):
        response = self.client.get("/api/admin/analytics/overview/")
        self.assertEqual(response.status_code, 401)

    def test_non_registrar_is_rejected(self):
        response = self.get(
            "/api/admin/analytics/overview/", token=self.other_token
        )
        self.assertEqual(response.status_code, 403)

    def test_registrar_can_read(self):
        response = self.get("/api/admin/analytics/overview/")
        self.assertEqual(response.status_code, 200)

    def test_professor_conflict_endpoint_uses_shared_auditor(self):
        token = Token.objects.create(user=self.assignment.prof.user)
        self.auth(token)

        response = self.client.get("/api/professor/me/schedule/conflicts/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("room_conflicts", response.data)
        self.assertIn("daily_hours_violations", response.data)


class AnalyticsSelectionTests(AnalyticsTestCase):
    def test_defaults_to_active_term_and_published_run(self):
        newer_feasible = ScheduleRunFactory(
            term=self.term, published=False, status="feasible"
        )
        newer_infeasible = ScheduleRunFactory(
            term=self.term, published=False, status="infeasible"
        )
        self.assertGreater(newer_feasible.id, self.run.id)
        self.assertGreater(newer_infeasible.id, newer_feasible.id)

        response = self.get("/api/admin/analytics/overview/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta"]["selection"], "latest_published")
        self.assertEqual(response.data["meta"]["term"]["code"], "2026-1")
        self.assertEqual(response.data["meta"]["run"]["id"], self.run.id)

    def test_explicit_term_code_is_supported(self):
        response = self.get("/api/admin/analytics/overview/?term=2026-1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta"]["term"]["id"], self.term.id)

    def test_run_and_term_mismatch_is_rejected(self):
        other_term = AcademicTermFactory(year=2025, semester=2)
        other_run = ScheduleRunFactory(term=other_term)

        response = self.get(
            f"/api/admin/analytics/overview/?term={self.term.id}"
            f"&run={other_run.id}"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("run", response.data)

    def test_unknown_term_is_rejected(self):
        response = self.get("/api/admin/analytics/overview/?term=9999-9")
        self.assertEqual(response.status_code, 400)
        self.assertIn("term", response.data)

    def test_no_active_term_falls_back_to_latest_run(self):
        AcademicTerm.objects.update(is_active=False)

        response = self.get("/api/admin/analytics/overview/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta"]["term"]["id"], self.term.id)
        self.assertEqual(response.data["meta"]["run"]["id"], self.run.id)
        self.assertEqual(response.data["meta"]["selection"], "latest_published")

    def test_empty_system_returns_empty_summaries(self):
        ScheduledClass.objects.all().delete()
        ScheduleRun.objects.all().delete()
        AcademicTerm.objects.update(is_active=False)

        response = self.get("/api/admin/analytics/overview/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["meta"]["term"])
        self.assertIsNone(response.data["meta"]["run"])
        self.assertIsNone(response.data["summary"]["quality"])
        self.assertEqual(
            response.data["summary"]["coverage"]["required_meetings"], 0
        )


class AnalyticsOverviewTests(AnalyticsTestCase):
    def test_overview_contains_quality_and_coverage(self):
        response = self.get("/api/admin/analytics/overview/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta"]["run"]["id"], self.run.id)
        self.assertEqual(
            response.data["summary"]["quality"]["soft_score_per_class"],
            10.0,
        )
        self.assertEqual(
            response.data["summary"]["coverage"]["covered_meetings"], 1
        )
        self.assertEqual(
            response.data["summary"]["coverage"]["coverage_pct"], 100.0
        )
        self.assertIn("catalog", response.data["data"])
        self.assertIn("conflicts", response.data["summary"])


class AnalyticsPartialOverlapTests(AnalyticsTestCase):
    def test_partial_overlap_is_reported_in_conflicts_endpoint(self):
        conflict_room = RoomFactory(name="R-202", capacity=40)
        second = AssignmentFactory(
            section=self.section,
            term=self.term,
            subject=SubjectFactory(code="CS102"),
        )
        ScheduledClass.objects.create(
            run=self.run,
            assignment=second,
            room=conflict_room,
            day=0,
            start_time=time(9, 30),
            duration_slots=1,
            mode="sync",
            term=self.term,
        )
        ScheduledClass.objects.create(
            run=self.run,
            assignment=self.assignment,
            room=conflict_room,
            day=0,
            start_time=time(9, 0),
            duration_slots=1,
            mode="sync",
            term=self.term,
        )

        response = self.get(
            f"/api/admin/schedules/runs/{self.run.id}/conflicts/"
        )

        self.assertEqual(response.status_code, 200)
        conflicts = response.data["room_conflicts"]
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["start_time"], "09:30")
        self.assertEqual(conflicts[0]["end_time"], "10:00")
        self.assertEqual(conflicts[0]["duration_minutes"], 30)
        self.assertEqual(len(conflicts[0]["classes"]), 2)

    def test_dashboard_counts_use_shared_auditor(self):
        run = ScheduleRunFactory(term=self.term, status="feasible")
        conflict_room = RoomFactory(name="R-202", capacity=40)
        first = AssignmentFactory(
            section=SectionFactory(term=self.term, name="BSIT-1B"),
            term=self.term,
            subject=SubjectFactory(code="CS102"),
        )
        second = AssignmentFactory(
            section=SectionFactory(term=self.term, name="BSIT-1C"),
            term=self.term,
            subject=SubjectFactory(code="CS103"),
        )
        for assignment in (first, second):
            ScheduledClass.objects.create(
                run=run,
                assignment=assignment,
                room=conflict_room,
                day=0,
                start_time=time(9, 0),
                duration_slots=1,
                mode="sync",
                term=self.term,
            )

        response = self.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        latest = response.data["latest_feasible_run"]
        self.assertEqual(latest["id"], run.id)
        self.assertEqual(latest["conflicts"], 1)


class AnalyticsQualityTests(AnalyticsTestCase):
    def test_best_run_is_global_not_just_current_page(self):
        best = ScheduleRunFactory(
            term=self.term,
            status="feasible",
            published=False,
            soft_score=2,
        )
        ScheduledClass.objects.create(
            run=best,
            assignment=self.assignment,
            room=self.room,
            day=0,
            start_time=time(8, 0),
            duration_slots=2,
            mode="sync",
            term=self.term,
        )
        newer = ScheduleRunFactory(
            term=self.term,
            status="feasible",
            published=False,
            soft_score=500,
        )
        ScheduledClass.objects.create(
            run=newer,
            assignment=self.assignment,
            room=self.room,
            day=0,
            start_time=time(8, 0),
            duration_slots=2,
            mode="sync",
            term=self.term,
        )

        response = self.get("/api/admin/analytics/quality/?limit=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["runs"]), 1)
        self.assertEqual(
            response.data["summary"]["best_run"]["run_id"], best.id
        )

    def test_invalid_status_is_rejected(self):
        response = self.get("/api/admin/analytics/quality/?status=nope")
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.data)

    def test_pagination_is_validated(self):
        response = self.get("/api/admin/analytics/quality/?limit=500")
        self.assertEqual(response.status_code, 400)
        self.assertIn("limit", response.data)


class AnalyticsWorkloadAndRoomsTests(AnalyticsTestCase):
    def test_workload_reports_scheduled_hours(self):
        response = self.get("/api/admin/analytics/workload/")

        self.assertEqual(response.status_code, 200)
        rows = response.data["data"]["professors"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["scheduled_hours"], 2)
        self.assertEqual(rows[0]["assignment_count"], 1)
        self.assertEqual(rows[0]["coverage_pct"], 100.0)

    def test_workload_filters_by_department(self):
        response = self.get(
            f"/api/admin/analytics/workload/"
            f"?department={self.assignment.prof.department_id}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["professors"]), 1)

        response = self.get("/api/admin/analytics/workload/?department=999999")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["professors"], [])

    def test_rooms_report_utilization_and_heatmap(self):
        response = self.get("/api/admin/analytics/rooms/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["heatmap"]), 66)
        room = response.data["data"]["rooms"][0]
        self.assertEqual(room["room"], "R-101")
        self.assertEqual(room["scheduled_hours"], 2)
        self.assertEqual(room["utilization_pct"], 3.03)
        self.assertEqual(
            response.data["summary"]["over_capacity_sessions"], 0
        )

    def test_rooms_filter_by_building(self):
        response = self.get("/api/admin/analytics/rooms/?building=Main")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["rooms"]), 1)

        response = self.get("/api/admin/analytics/rooms/?building=Nowhere")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["rooms"], [])


class AnalyticsSectionsTests(AnalyticsTestCase):
    def test_sections_report_coverage(self):
        response = self.get("/api/admin/analytics/sections/")

        self.assertEqual(response.status_code, 200)
        rows = response.data["data"]["sections"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["section"], "BSIT-1A")
        self.assertEqual(rows[0]["status"], "covered")
        self.assertEqual(rows[0]["coverage_pct"], 100.0)

    def test_program_filter_is_applied(self):
        response = self.get("/api/admin/analytics/sections/?program=BSIT")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["sections"]), 1)

        response = self.get("/api/admin/analytics/sections/?program=BSCS")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["sections"], [])
