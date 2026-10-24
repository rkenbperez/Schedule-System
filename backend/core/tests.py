from unittest.mock import patch

from django.db.utils import OperationalError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthEndpointTests(APITestCase):
    def test_health_returns_ok(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"status": "ok", "database": "ok"})

    @patch("core.views.logger")
    @patch("core.views.connection")
    def test_health_returns_503_when_database_unavailable(self, mock_connection, mock_logger):
        mock_connection.cursor.side_effect = OperationalError("database unavailable")

        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data, {"status": "error", "database": "error"})
        self.assertTrue(mock_logger.exception.called)
