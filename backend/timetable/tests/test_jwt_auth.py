"""JWT Authentication tests."""

from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from users.models import Professors
from catalog.models import Department

User = get_user_model()


class JWTAuthTests(TestCase):
    """Test JWT authentication flows."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="jwtuser", password="jwtpass123"
        )
        self.prof_user = User.objects.create_user(
            username="jwtprof", password="jwtpass123"
        )
        dept = Department.objects.create(name="CS")
        self.prof = Professors.objects.create(user=self.prof_user, department=dept)
        
        self.registrar = User.objects.create_user(
            username="jwtreg", password="jwtpass123", is_staff=True
        )

    def get_tokens(self, user):
        """Helper to get JWT tokens for a user."""
        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

    def auth_header(self, access_token):
        return {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}

    # ==================== TOKEN OBTAIN ====================
    
    def test_obtain_pair_valid_credentials(self):
        """POST /api/token/ with valid credentials returns access + refresh."""
        response = self.client.post("/api/token/", {
            "username": "jwtuser",
            "password": "jwtpass123"
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_obtain_pair_invalid_credentials(self):
        """POST /api/token/ with wrong password returns 401."""
        response = self.client.post("/api/token/", {
            "username": "jwtuser",
            "password": "wrongpass"
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_obtain_pair_nonexistent_user(self):
        """POST /api/token/ with nonexistent user returns 401."""
        response = self.client.post("/api/token/", {
            "username": "nonexistent",
            "password": "anypass"
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_obtain_pair_missing_fields(self):
        """POST /api/token/ with missing fields returns 400."""
        response = self.client.post("/api/token/", {"username": "jwtuser"}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/token/", {"password": "jwtpass123"}, format="json")
        self.assertEqual(response.status_code, 400)

    # ==================== TOKEN REFRESH ====================
    
    def test_refresh_valid_token(self):
        """POST /api/token/refresh/ with valid refresh returns new access."""
        tokens = self.get_tokens(self.user)
        response = self.client.post("/api/token/refresh/", {
            "refresh": tokens["refresh"]
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        # New access token should be different
        self.assertNotEqual(response.data["access"], tokens["access"])

    def test_refresh_invalid_token(self):
        """POST /api/token/refresh/ with invalid refresh returns 401."""
        response = self.client.post("/api/token/refresh/", {
            "refresh": "invalid.token.here"
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_refresh_expired_token(self):
        """POST /api/token/refresh/ with expired refresh returns 401."""
        # Create an expired refresh token manually
        refresh = RefreshToken.for_user(self.user)
        refresh.set_exp(lifetime=timedelta(seconds=-1))  # Expired
        response = self.client.post("/api/token/refresh/", {
            "refresh": str(refresh)
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_refresh_rotates_token(self):
        """Refresh rotates the refresh token (ROTATE_REFRESH_TOKENS=True)."""
        tokens = self.get_tokens(self.user)
        response = self.client.post("/api/token/refresh/", {
            "refresh": tokens["refresh"]
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("refresh", response.data)
        # New refresh should be different
        self.assertNotEqual(response.data["refresh"], tokens["refresh"])

    # ==================== TOKEN VERIFY ====================
    
    def test_verify_valid_token(self):
        """POST /api/token/verify/ with valid access returns 200."""
        tokens = self.get_tokens(self.user)
        response = self.client.post("/api/token/verify/", {
            "token": tokens["access"]
        }, format="json")
        self.assertEqual(response.status_code, 200)

    def test_verify_invalid_token(self):
        """POST /api/token/verify/ with invalid token returns 401."""
        response = self.client.post("/api/token/verify/", {
            "token": "invalid.token.here"
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_verify_expired_token(self):
        """POST /api/token/verify/ with expired token returns 401."""
        access = AccessToken.for_user(self.user)
        access.set_exp(lifetime=timedelta(seconds=-1))
        response = self.client.post("/api/token/verify/", {
            "token": str(access)
        }, format="json")
        self.assertEqual(response.status_code, 401)

    # ==================== PROTECTED ENDPOINTS ====================
    
    def test_access_protected_endpoint_with_valid_token(self):
        """Valid access token allows access to protected endpoints."""
        tokens = self.get_tokens(self.registrar)
        response = self.client.get("/api/rooms/", **self.auth_header(tokens["access"]))
        self.assertEqual(response.status_code, 200)

    def test_reject_protected_endpoint_without_token(self):
        """Missing token returns 401."""
        response = self.client.get("/api/rooms/")
        self.assertEqual(response.status_code, 401)

    def test_reject_protected_endpoint_with_invalid_token(self):
        """Invalid token returns 401."""
        response = self.client.get("/api/rooms/", **self.auth_header("invalid.token"))
        self.assertEqual(response.status_code, 401)

    def test_reject_protected_endpoint_with_expired_token(self):
        """Expired access token returns 401."""
        access = AccessToken.for_user(self.registrar)
        access.set_exp(lifetime=timedelta(seconds=-1))
        response = self.client.get("/api/rooms/", **self.auth_header(str(access)))
        self.assertEqual(response.status_code, 401)

    # ==================== ROLE-BASED ACCESS WITH JWT ====================
    
    def test_registrar_jwt_can_generate_schedule(self):
        """Registrar with JWT can generate schedule."""
        tokens = self.get_tokens(self.registrar)
        # Need some data first - use API to create
        dept_resp = self.client.post("/api/departments/", {"name": "CS_JWT"}, format="json", **self.auth_header(tokens["access"]))
        self.assertEqual(dept_resp.status_code, 201)
        dept_id = dept_resp.data["id"]
        
        room_resp = self.client.post("/api/rooms/", {"name": "R1", "capacity": 30, "department": dept_id}, format="json", **self.auth_header(tokens["access"]))
        
        # Create a new user for the professor (since self.prof_user already has a profile from setUp)
        new_prof_user = User.objects.create_user(username="newprof", password="pass")
        prof_resp = self.client.post("/api/profs/", {"user": new_prof_user.id, "department": dept_id}, format="json", **self.auth_header(tokens["access"]))
        self.assertEqual(prof_resp.status_code, 201)
        
        subj_resp = self.client.post("/api/subjects/", {"code": "CS101", "title": "Test", "units": 3}, format="json", **self.auth_header(tokens["access"]))
        sec_resp = self.client.post("/api/sections/", {"name": "SEC1", "headcount": 30}, format="json", **self.auth_header(tokens["access"]))
        
        self.client.post("/api/assignments/", {
            "prof": prof_resp.data["id"],
            "subject": subj_resp.data["id"],
            "section": sec_resp.data["id"],
            "meetings": [{"mode": "sync"}]
        }, format="json", **self.auth_header(tokens["access"]))
        
        self.client.post("/api/availability-windows/", {
            "prof": prof_resp.data["id"], "day": 0,
            "start_time": "08:00:00", "end_time": "17:00:00"
        }, format="json", **self.auth_header(tokens["access"]))
        
        response = self.client.post("/api/schedules/generate", {
            "algorithm": "greedy"
        }, format="json", **self.auth_header(tokens["access"]))
        self.assertEqual(response.status_code, 201)

    def test_professor_jwt_cannot_generate_schedule(self):
        """Professor with JWT cannot generate schedule."""
        tokens = self.get_tokens(self.prof_user)
        response = self.client.post("/api/schedules/generate", {
            "algorithm": "greedy"
        }, format="json", **self.auth_header(tokens["access"]))
        self.assertEqual(response.status_code, 403)

    # ==================== TOKEN BLACKLIST ====================
    
    def test_blacklisted_refresh_rejected(self):
        """Blacklisted refresh token is rejected on refresh."""
        # Get tokens via login endpoint (tracked by blacklist)
        response = self.client.post("/api/token/", {
            "username": "jwtuser",
            "password": "jwtpass123"
        }, format="json")
        self.assertEqual(response.status_code, 200)
        tokens = response.json()
        
        # First refresh - should work and rotate
        response1 = self.client.post("/api/token/refresh/", {
            "refresh": tokens["refresh"]
        }, format="json")
        self.assertEqual(response1.status_code, 200)
        
        # Old refresh should now be blacklisted
        response2 = self.client.post("/api/token/refresh/", {
            "refresh": tokens["refresh"]
        }, format="json")
        self.assertEqual(response2.status_code, 401)

    # ==================== TOKEN LIFETIME ====================
    
    def test_access_token_lifetime_1_hour(self):
        """Access token lifetime is 1 hour by default."""
        tokens = self.get_tokens(self.user)
        access = AccessToken(tokens["access"])
        lifetime = access["exp"] - access["iat"]
        # Should be ~3600 seconds (1 hour)
        self.assertAlmostEqual(lifetime, 3600, delta=60)

    def test_refresh_token_lifetime_7_days(self):
        """Refresh token lifetime is 7 days by default."""
        tokens = self.get_tokens(self.user)
        refresh = RefreshToken(tokens["refresh"])
        lifetime = refresh["exp"] - refresh["iat"]
        # Should be ~604800 seconds (7 days)
        self.assertAlmostEqual(lifetime, 604800, delta=3600)


class JWTIntegrationTests(TestCase):
    """Integration tests for JWT with the full API flow."""

    def setUp(self):
        self.client = APIClient()
        self.registrar = User.objects.create_user(
            username="reg", password="regpass123", is_staff=True
        )
        self.reg_tokens = self.get_tokens(self.registrar)

    def get_tokens(self, user):
        refresh = RefreshToken.for_user(user)
        return {"access": str(refresh.access_token), "refresh": str(refresh)}

    def auth_header(self, access_token):
        return {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}

    def test_full_flow_with_jwt(self):
        """Complete flow: login -> create catalog -> generate -> view."""
        # 1. Create department
        response = self.client.post("/api/departments/", {"name": "CS"}, format="json", 
                                   **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)
        dept_id = response.data["id"]

        # 2. Create room
        response = self.client.post("/api/rooms/", {"name": "R101", "capacity": 40, "department": dept_id}, 
                                   format="json", **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)
        room_id = response.data["id"]

        # 3. Create professor
        prof_user = User.objects.create_user(username="prof1", password="pass")
        response = self.client.post("/api/profs/", {"user": prof_user.id, "department": dept_id}, 
                                   format="json", **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)
        prof_id = response.data["id"]

        # 4. Create subject
        response = self.client.post("/api/subjects/", {"code": "CS101", "title": "Intro", "units": 3}, 
                                   format="json", **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)
        subj_id = response.data["id"]

        # 5. Create section
        response = self.client.post("/api/sections/", {"name": "CS-1A", "headcount": 30}, 
                                   format="json", **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)
        sec_id = response.data["id"]

        # 6. Create assignment
        response = self.client.post("/api/assignments/", {
            "prof": prof_id, "subject": subj_id, "section": sec_id,
            "meetings": [{"mode": "sync", "duration_slots": 2}]
        }, format="json", **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)

        # 7. Create availability
        response = self.client.post("/api/availability-windows/", {
            "prof": prof_id, "day": 0, "start_time": "08:00:00", "end_time": "17:00:00"
        }, format="json", **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)

        # 8. Generate schedule
        response = self.client.post("/api/schedules/generate", {
            "algorithm": "greedy"
        }, format="json", **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 201)
        run_id = response.data["run_id"]

        # 9. View classes
        response = self.client.get(f"/api/schedules/runs/{run_id}/classes", 
                                  **self.auth_header(self.reg_tokens["access"]))
        self.assertEqual(response.status_code, 200)

        # 10. Professor views their schedule
        prof_tokens = self.get_tokens(prof_user)
        response = self.client.get("/api/schedules/my", **self.auth_header(prof_tokens["access"]))
        self.assertEqual(response.status_code, 200)
        for cls in response.data:
            self.assertEqual(cls["prof_id"], prof_id)