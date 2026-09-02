from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Professors


class LoginAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="prof1", password="pass12345")
        Professors.objects.create(user=self.user, department="CCS")

    def tearDown(self):
        cache.clear()

    def test_login_returns_token(self):
        url = reverse("login")
        response = self.client.post(
            url,
            {"username": "prof1", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertTrue(Token.objects.filter(user=self.user).exists())
        self.assertEqual(response.data["user"]["username"], "prof1")

    def test_login_wrong_password(self):
        url = reverse("login")
        response = self.client.post(
            url,
            {"username": "prof1", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_throttled_after_limit(self):
        url = reverse("login")
        for _ in range(10):
            self.client.post(url, {"username": "prof1", "password": "pass12345"}, format="json")
        response = self.client.post(
            url, {"username": "prof1", "password": "pass12345"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
