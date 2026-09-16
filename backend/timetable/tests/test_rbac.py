"""RBAC (Role-Based Access Control) tests for API endpoints."""

from datetime import time
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

from catalog.models import Department, Room, Section, Subject
from timetable.models import (
    Assignment, AvailabilityWindow, BusyBlock, MeetingSlot, ScheduledClass, ScheduleRun
)
from users.models import Professors
from timetable.tests.factories import (
    RegistrarFactory, ProfessorFactory, ProfessorUserFactory,
    DepartmentFactory, RoomFactory, SectionFactory, SubjectFactory,
    AssignmentFactory, MeetingSlotFactory, AvailabilityWindowFactory, BusyBlockFactory
)
from timetable.engines import run
from timetable.scenario_builder import build_scenario

User = get_user_model()


class RBACTests(APITestCase):
    """Test role-based access control for all API endpoints."""

    def setUp(self):
        # Create users with different roles
        self.registrar = RegistrarFactory()
        self.reg_token = Token.objects.create(user=self.registrar)
        
        self.prof_user = ProfessorUserFactory()
        self.prof = ProfessorFactory(user=self.prof_user)
        self.prof_token = Token.objects.create(user=self.prof_user)
        
        self.anonymous_user = None
        
        # Common test data
        self.dept = DepartmentFactory()
        self.room = RoomFactory(department=self.dept)
        self.section = SectionFactory()
        self.subject = SubjectFactory()
        self.assignment = AssignmentFactory(prof=self.prof, subject=self.subject, section=self.section)
        MeetingSlotFactory(assignment=self.assignment, mode="sync", duration_slots=2)
        AvailabilityWindowFactory(prof=self.prof, day=0)
        BusyBlockFactory(prof=self.prof, day=0)
        
        # Generate a schedule run using engine directly
        self.schedule_run = self._generate_schedule()

    def auth(self, token):
        if token:
            self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        else:
            self.client.credentials()

    def _generate_schedule(self):
        """Generate a schedule run as registrar using engine directly."""
        scenario = build_scenario()
        result = run("greedy", scenario, time_limit_s=30)
        
        run_obj = ScheduleRun.objects.create(
            algorithm="greedy",
            status=ScheduleRun.Status.FEASIBLE if result.feasible else ScheduleRun.Status.INFEASIBLE,
            runtime_ms=result.runtime_ms,
            soft_score=result.soft_score,
            created_by=self.registrar,
        )
        for pc in result.classes:
            ScheduledClass.objects.create(
                run=run_obj,
                assignment_id=pc.assignment_id,
                room_id=pc.room_id,
                day=pc.day,
                start_time=time(pc.start // 60, pc.start % 60),
                duration_slots=pc.duration_slots,
                mode=pc.mode or None,
            )
        return run_obj

    # ==================== SCHEDULE GENERATION ====================
    
    def test_registrar_can_generate_schedule(self):
        """Registrar can POST /schedules/generate/"""
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {
            "algorithm": "greedy"
        }, format="json")
        self.assertEqual(response.status_code, 201)

    def test_professor_cannot_generate_schedule(self):
        """Professor cannot POST /schedules/generate/"""
        self.auth(self.prof_token)
        response = self.client.post("/api/schedules/generate", {
            "algorithm": "greedy"
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_generate_schedule(self):
        """Anonymous cannot POST /schedules/generate/"""
        self.auth(None)
        response = self.client.post("/api/schedules/generate", {
            "algorithm": "greedy"
        }, format="json")
        self.assertEqual(response.status_code, 401)

    # ==================== SCHEDULE RUNS LIST ====================
    
    def test_registrar_can_list_runs(self):
        """Registrar can GET /schedules/runs/"""
        self.auth(self.reg_token)
        response = self.client.get("/api/schedules/runs")
        self.assertEqual(response.status_code, 200)

    def test_professor_cannot_list_runs(self):
        """Professor cannot GET /schedules/runs/"""
        self.auth(self.prof_token)
        response = self.client.get("/api/schedules/runs")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_list_runs(self):
        """Anonymous cannot GET /schedules/runs/"""
        self.auth(None)
        response = self.client.get("/api/schedules/runs")
        self.assertEqual(response.status_code, 401)

    # ==================== SCHEDULE RUN CLASSES ====================
    
    def test_registrar_can_view_run_classes(self):
        """Registrar can GET /schedules/runs/{id}/classes"""
        self.auth(self.reg_token)
        print(f"DEBUG: schedule_run.id = {self.schedule_run.id}")
        print(f"DEBUG: classes count = {self.schedule_run.classes.count()}")
        response = self.client.get(f"/api/schedules/runs/{self.schedule_run.id}/classes")
        print(f"DEBUG: response.status_code = {response.status_code}")
        print(f"DEBUG: response.data = {response.data}")
        self.assertEqual(response.status_code, 200)

    def test_professor_can_view_own_classes(self):
        """Professor can view classes for their assignments"""
        self.auth(self.prof_token)
        response = self.client.get(f"/api/schedules/runs/{self.schedule_run.id}/classes")
        self.assertEqual(response.status_code, 200)
        # Should only see their own classes
        for cls in response.data:
            self.assertEqual(cls["prof_id"], self.prof.id)

    def test_anonymous_cannot_view_run_classes(self):
        """Anonymous cannot GET /schedules/runs/{id}/classes"""
        self.auth(None)
        response = self.client.get(f"/api/schedules/runs/{self.schedule_run.id}/classes")
        self.assertEqual(response.status_code, 401)

    # ==================== MY SCHEDULE ====================
    
    def test_professor_can_view_my_schedule(self):
        """Professor can GET /schedules/my/"""
        self.auth(self.prof_token)
        response = self.client.get("/api/schedules/my")
        self.assertEqual(response.status_code, 200)
        for cls in response.data:
            self.assertEqual(cls["prof_id"], self.prof.id)

    def test_registrar_can_view_my_schedule(self):
        """Registrar can GET /schedules/my/ (shows all)"""
        self.auth(self.reg_token)
        response = self.client.get("/api/schedules/my")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_view_my_schedule(self):
        """Anonymous cannot GET /schedules/my/"""
        self.auth(None)
        response = self.client.get("/api/schedules/my")
        self.assertEqual(response.status_code, 401)

    # ==================== ASSIGNMENTS ====================
    
    def test_registrar_can_create_assignment(self):
        """Registrar can POST /assignments/"""
        self.auth(self.reg_token)
        # Use a different subject/section to avoid unique constraint
        other_subject = SubjectFactory()
        other_section = SectionFactory()
        response = self.client.post("/api/assignments/", {
            "prof": self.prof.id,
            "subject": other_subject.id,
            "section": other_section.id,
            "meetings": [{"mode": "sync", "duration_slots": 2}]
        }, format="json")
        print(f"DEBUG: response.status_code = {response.status_code}")
        print(f"DEBUG: response.data = {response.data}")
        self.assertEqual(response.status_code, 201)

    def test_professor_cannot_create_assignment(self):
        """Professor cannot POST /assignments/"""
        self.auth(self.prof_token)
        response = self.client.post("/api/assignments/", {
            "prof": self.prof.id,
            "subject": self.subject.id,
            "section": self.section.id,
            "meetings": [{"mode": "sync"}]
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_create_assignment(self):
        """Anonymous cannot POST /assignments/"""
        self.auth(None)
        response = self.client.post("/api/assignments/", {
            "prof": self.prof.id,
            "subject": self.subject.id,
            "section": self.section.id,
            "meetings": [{"mode": "sync"}]
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_registrar_can_update_assignment(self):
        """Registrar can PATCH /assignments/{id}/"""
        self.auth(self.reg_token)
        response = self.client.patch(f"/api/assignments/{self.assignment.id}/", {
            "section": self.section.id
        }, format="json")
        self.assertEqual(response.status_code, 200)

    def test_professor_cannot_update_assignment(self):
        """Professor cannot PATCH /assignments/{id}/"""
        self.auth(self.prof_token)
        response = self.client.patch(f"/api/assignments/{self.assignment.id}/", {
            "section": self.section.id
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_update_assignment(self):
        """Anonymous cannot PATCH /assignments/{id}/"""
        self.auth(None)
        response = self.client.patch(f"/api/assignments/{self.assignment.id}/", {
            "section": self.section.id
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_registrar_can_list_assignments(self):
        """Registrar can GET /assignments/"""
        self.auth(self.reg_token)
        response = self.client.get("/api/assignments/")
        self.assertEqual(response.status_code, 200)

    def test_professor_can_list_own_assignments(self):
        """Professor can GET /assignments/ (sees own)"""
        self.auth(self.prof_token)
        response = self.client.get("/api/assignments/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_list_assignments(self):
        """Anonymous cannot GET /assignments/"""
        self.auth(None)
        response = self.client.get("/api/assignments/")
        self.assertEqual(response.status_code, 401)

    # ==================== AVAILABILITY WINDOWS ====================
    
    def test_professor_can_create_own_availability(self):
        """Professor can POST /availability-windows/ for themselves"""
        self.auth(self.prof_token)
        response = self.client.post("/api/availability-windows/", {
            "prof": self.prof.id,
            "day": 1,
            "start_time": "09:00:00",
            "end_time": "16:00:00",
            "is_preferred": True
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], self.prof.id)

    def test_professor_availability_forced_to_own(self):
        """Professor's availability is forced to their own profile"""
        other_user = User.objects.create_user(username="prof2", password="testpass123")
        other_prof = Professors.objects.create(user=other_user, department=self.dept)
        
        self.auth(self.prof_token)
        response = self.client.post("/api/availability-windows/", {
            "prof": other_prof.id,
            "day": 1,
            "start_time": "09:00:00",
            "end_time": "16:00:00",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], self.prof.id)  # Forced to own

    def test_professor_only_sees_own_availability(self):
        """Professor only sees their own availability"""
        other_user = User.objects.create_user(username="prof2", password="testpass123")
        other_prof = Professors.objects.create(user=other_user, department=self.dept)
        AvailabilityWindowFactory(prof=other_prof, day=0)
        
        self.auth(self.prof_token)
        response = self.client.get("/api/availability-windows/")
        self.assertEqual(response.status_code, 200)
        # Should only see own
        for aw in response.data["results"]:
            self.assertEqual(aw["prof"], self.prof.id)

    def test_registrar_can_manage_all_availability(self):
        """Registrar can create availability for any professor"""
        other_user = User.objects.create_user(username="prof2", password="testpass123")
        other_prof = Professors.objects.create(user=other_user, department=self.dept)
        
        self.auth(self.reg_token)
        response = self.client.post("/api/availability-windows/", {
            "prof": other_prof.id,
            "day": 1,
            "start_time": "09:00:00",
            "end_time": "16:00:00",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], other_prof.id)

    def test_anonymous_cannot_access_availability(self):
        """Anonymous cannot GET/POST /availability-windows/"""
        self.auth(None)
        response = self.client.get("/api/availability-windows/")
        self.assertEqual(response.status_code, 401)
        response = self.client.post("/api/availability-windows/", {
            "prof": self.prof.id, "day": 0, "start_time": "08:00:00", "end_time": "17:00:00"
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_registrar_can_list_availability(self):
        """Registrar can GET /availability-windows/ (all)"""
        self.auth(self.reg_token)
        response = self.client.get("/api/availability-windows/")
        self.assertEqual(response.status_code, 200)

    def test_professor_can_list_own_availability(self):
        """Professor can GET /availability-windows/ (own)"""
        self.auth(self.prof_token)
        response = self.client.get("/api/availability-windows/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_list_availability(self):
        """Anonymous cannot GET /availability-windows/"""
        self.auth(None)
        response = self.client.get("/api/availability-windows/")
        self.assertEqual(response.status_code, 401)

    # ==================== BUSY BLOCKS ====================
    
    def test_professor_can_create_own_busy_block(self):
        """Professor can POST /busy-blocks/ for themselves"""
        self.auth(self.prof_token)
        response = self.client.post("/api/busy-blocks/", {
            "prof": self.prof.id,
            "day": 1,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], self.prof.id)

    def test_professor_busy_block_forced_to_own(self):
        """Professor's busy block is forced to their own profile"""
        other_user = User.objects.create_user(username="prof3", password="testpass123")
        other_prof = Professors.objects.create(user=other_user, department=self.dept)
        
        self.auth(self.prof_token)
        response = self.client.post("/api/busy-blocks/", {
            "prof": other_prof.id,
            "day": 1,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], self.prof.id)  # Forced to own

    def test_professor_only_sees_own_busy_blocks(self):
        """Professor only sees their own busy blocks"""
        other_user = User.objects.create_user(username="prof3", password="testpass123")
        other_prof = Professors.objects.create(user=other_user, department=self.dept)
        BusyBlockFactory(prof=other_prof, day=0)
        
        self.auth(self.prof_token)
        response = self.client.get("/api/busy-blocks/")
        self.assertEqual(response.status_code, 200)
        for bb in response.data["results"]:
            self.assertEqual(bb["prof"], self.prof.id)

    def test_registrar_can_manage_all_busy_blocks(self):
        """Registrar can create busy blocks for any professor"""
        other_user = User.objects.create_user(username="prof3", password="testpass123")
        other_prof = Professors.objects.create(user=other_user, department=self.dept)
        
        self.auth(self.reg_token)
        response = self.client.post("/api/busy-blocks/", {
            "prof": other_prof.id,
            "day": 1,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], other_prof.id)

    def test_anonymous_cannot_access_busy_blocks(self):
        """Anonymous cannot GET/POST /busy-blocks/"""
        self.auth(None)
        response = self.client.get("/api/busy-blocks/")
        self.assertEqual(response.status_code, 401)
        response = self.client.post("/api/busy-blocks/", {
            "prof": self.prof.id, "day": 0, "start_time": "12:00:00", "end_time": "13:00:00"
        }, format="json")
        self.assertEqual(response.status_code, 401)

    # ==================== CATALOG ====================
    
    def test_registrar_can_create_room(self):
        """Registrar can POST /rooms/"""
        self.auth(self.reg_token)
        response = self.client.post("/api/rooms/", {
            "name": "R999", "capacity": 50
        }, format="json")
        self.assertEqual(response.status_code, 201)

    def test_professor_cannot_create_room(self):
        """Professor cannot POST /rooms/"""
        self.auth(self.prof_token)
        response = self.client.post("/api/rooms/", {
            "name": "R999", "capacity": 50
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_create_room(self):
        """Anonymous cannot POST /rooms/"""
        self.auth(None)
        response = self.client.post("/api/rooms/", {
            "name": "R999", "capacity": 50
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_any_authenticated_can_read_rooms(self):
        """Any authenticated user can GET /rooms/"""
        self.auth(self.prof_token)
        response = self.client.get("/api/rooms/")
        self.assertEqual(response.status_code, 200)
        
        # Student (no prof profile) can also read
        student = User.objects.create_user(username="student1", password="pass")
        student_token = Token.objects.create(user=student)
        self.auth(student_token)
        response = self.client.get("/api/rooms/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_read_rooms(self):
        """Anonymous cannot GET /rooms/"""
        self.auth(None)
        response = self.client.get("/api/rooms/")
        self.assertEqual(response.status_code, 401)

    def test_registrar_can_create_department(self):
        """Registrar can POST /departments/"""
        self.auth(self.reg_token)
        response = self.client.post("/api/departments/", {"name": "EE"}, format="json")
        self.assertEqual(response.status_code, 201)

    def test_professor_cannot_create_department(self):
        """Professor cannot POST /departments/"""
        self.auth(self.prof_token)
        response = self.client.post("/api/departments/", {"name": "EE"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_create_department(self):
        """Anonymous cannot POST /departments/"""
        self.auth(None)
        response = self.client.post("/api/departments/", {"name": "EE"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_any_authenticated_can_read_departments(self):
        """Any authenticated user can GET /departments/"""
        self.auth(self.prof_token)
        response = self.client.get("/api/departments/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_read_departments(self):
        """Anonymous cannot GET /departments/"""
        self.auth(None)
        response = self.client.get("/api/departments/")
        self.assertEqual(response.status_code, 401)

    def test_registrar_can_create_section(self):
        """Registrar can POST /sections/"""
        self.auth(self.reg_token)
        response = self.client.post("/api/sections/", {
            "name": "SEC-NEW", "headcount": 30
        }, format="json")
        self.assertEqual(response.status_code, 201)

    def test_professor_cannot_create_section(self):
        """Professor cannot POST /sections/"""
        self.auth(self.prof_token)
        response = self.client.post("/api/sections/", {
            "name": "SEC-NEW", "headcount": 30
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_create_section(self):
        """Anonymous cannot POST /sections/"""
        self.auth(None)
        response = self.client.post("/api/sections/", {
            "name": "SEC-NEW", "headcount": 30
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_any_authenticated_can_read_sections(self):
        """Any authenticated user can GET /sections/"""
        self.auth(self.prof_token)
        response = self.client.get("/api/sections/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_read_sections(self):
        """Anonymous cannot GET /sections/"""
        self.auth(None)
        response = self.client.get("/api/sections/")
        self.assertEqual(response.status_code, 401)

    def test_registrar_can_create_subject(self):
        """Registrar can POST /subjects/"""
        self.auth(self.reg_token)
        response = self.client.post("/api/subjects/", {
            "code": "SUB999", "title": "New Subject", "units": 3
        }, format="json")
        self.assertEqual(response.status_code, 201)

    def test_professor_cannot_create_subject(self):
        """Professor cannot POST /subjects/"""
        self.auth(self.prof_token)
        response = self.client.post("/api/subjects/", {
            "code": "SUB999", "title": "New Subject", "units": 3
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_create_subject(self):
        """Anonymous cannot POST /subjects/"""
        self.auth(None)
        response = self.client.post("/api/subjects/", {
            "code": "SUB999", "title": "New Subject", "units": 3
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_any_authenticated_can_read_subjects(self):
        """Any authenticated user can GET /subjects/"""
        self.auth(self.prof_token)
        response = self.client.get("/api/subjects/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_read_subjects(self):
        """Anonymous cannot GET /subjects/"""
        self.auth(None)
        response = self.client.get("/api/subjects/")
        self.assertEqual(response.status_code, 401)

    def test_registrar_can_create_prof(self):
        """Registrar can POST /profs/"""
        self.auth(self.reg_token)
        user = User.objects.create_user(username="newprof", password="pass")
        response = self.client.post("/api/profs/", {
            "user": user.id,
            "department": self.dept.id
        }, format="json")
        self.assertEqual(response.status_code, 201)

    def test_professor_cannot_create_prof(self):
        """Professor cannot POST /profs/"""
        self.auth(self.prof_token)
        user = User.objects.create_user(username="newprof2", password="pass")
        response = self.client.post("/api/profs/", {
            "user": user.id,
            "department": self.dept.id
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_create_prof(self):
        """Anonymous cannot POST /profs/"""
        self.auth(None)
        user = User.objects.create_user(username="newprof3", password="pass")
        response = self.client.post("/api/profs/", {
            "user": user.id,
            "department": self.dept.id
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_any_authenticated_can_read_profs(self):
        """Any authenticated user can GET /profs/"""
        self.auth(self.prof_token)
        response = self.client.get("/api/profs/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_cannot_read_profs(self):
        """Anonymous cannot GET /profs/"""
        self.auth(None)
        response = self.client.get("/api/profs/")
        self.assertEqual(response.status_code, 401)

    # ==================== ANONYMOUS ACCESS ====================
    
    def test_anonymous_cannot_access_protected_endpoints(self):
        """Anonymous cannot access any protected endpoint"""
        endpoints = [
            ("/api/rooms/", "get"),
            ("/api/rooms/", "post"),
            ("/api/assignments/", "get"),
            ("/api/assignments/", "post"),
            ("/api/availability-windows/", "get"),
            ("/api/availability-windows/", "post"),
            ("/api/busy-blocks/", "get"),
            ("/api/busy-blocks/", "post"),
            ("/api/schedules/runs", "get"),
            ("/api/schedules/generate", "post"),
            ("/api/assignments/", "get"),
            ("/api/assignments/", "post"),
            ("/api/departments/", "get"),
            ("/api/departments/", "post"),
            ("/api/rooms/", "get"),
            ("/api/rooms/", "post"),
            ("/api/sections/", "get"),
            ("/api/sections/", "post"),
            ("/api/subjects/", "get"),
            ("/api/subjects/", "post"),
            ("/api/profs/", "get"),
            ("/api/profs/", "post"),
        ]
        self.auth(None)
        for url, method in endpoints:
            response = getattr(self.client, method)(url)
            self.assertEqual(response.status_code, 401, f"{method} {url} should require auth")