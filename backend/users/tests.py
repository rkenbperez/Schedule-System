from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from catalog.models import Department
from .models import Professors


class LoginAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="prof1", email="prof1@example.com", password="pass12345"
        )
        dept = Department.objects.create(name="CCS")
        Professors.objects.create(user=self.user, department=dept)
        self.url = reverse("jwt-login")
        self.credentials = {"email": "prof1@example.com", "password": "pass12345"}

    def tearDown(self):
        cache.clear()

    def test_login_returns_token(self):
        response = self.client.post(self.url, self.credentials, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["username"], "prof1")
        self.assertEqual(response.data["user"]["role"], "professor")

    def test_login_wrong_password(self):
        response = self.client.post(
            self.url,
            {"email": "prof1@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_throttled_after_limit(self):
        for _ in range(10):
            self.client.post(self.url, self.credentials, format="json")
        response = self.client.post(self.url, self.credentials, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
