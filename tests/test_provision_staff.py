"""Staff provisioning endpoint: superuser-only, creates new accounts with
their own passwords/PINs, never overwrites an existing account, and can
retire shared-password demo logins."""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient


class ProvisionStaffTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        cls.admin = get_user_model().objects.get(username="admin")
        cls.operator = get_user_model().objects.get(username="operator")

    def setUp(self):
        self.client = APIClient()

    def _batch(self):
        return {"accounts": [{"username": "weighbridge.mur", "password": "Str0ng!Pass-1",
                              "pin": "8642", "role": "weighing_clerk", "station": "MUR",
                              "first_name": "Weighing Clerk", "last_name": "MUR"}],
                "deactivate": ["operator"]}

    def test_non_superuser_forbidden(self):
        self.client.force_authenticate(self.operator)
        r = self.client.post("/api/admin/provision-staff/", self._batch(), format="json")
        self.assertEqual(r.status_code, 403)

    def test_create_login_and_deactivate(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/admin/provision-staff/", self._batch(), format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["created"], ["weighbridge.mur"])
        self.assertEqual(r.json()["deactivated"], ["operator"])
        # the new account can sign in and carries its role + station scope
        anon = APIClient()
        login = anon.post("/api/auth/login/", {"username": "weighbridge.mur", "password": "Str0ng!Pass-1"}, format="json")
        self.assertEqual(login.status_code, 200, login.content)
        self.assertIn("weighing_clerk", login.json()["user"]["role_codes"])
        self.assertEqual(login.json()["user"]["roles"][0]["station_code"], "MUR")
        # the deactivated demo account can no longer sign in
        old = anon.post("/api/auth/login/", {"username": "operator", "password": "MuragoAdmin2026!"}, format="json")
        self.assertEqual(old.status_code, 401)

    def test_rerun_never_overwrites_password(self):
        self.client.force_authenticate(self.admin)
        self.client.post("/api/admin/provision-staff/", self._batch(), format="json")
        batch2 = {"accounts": [{"username": "weighbridge.mur", "password": "Different!Pass-2",
                                "role": "weighing_clerk", "station": "MUR"}]}
        r = self.client.post("/api/admin/provision-staff/", batch2, format="json")
        self.assertEqual(r.json()["created"], [])
        self.assertEqual(r.json()["skipped"][0]["username"], "weighbridge.mur")
        anon = APIClient()
        ok = anon.post("/api/auth/login/", {"username": "weighbridge.mur", "password": "Str0ng!Pass-1"}, format="json")
        self.assertEqual(ok.status_code, 200)
        bad = anon.post("/api/auth/login/", {"username": "weighbridge.mur", "password": "Different!Pass-2"}, format="json")
        self.assertEqual(bad.status_code, 401)

    def test_explicit_reset_recovers_interrupted_account(self):
        self.client.force_authenticate(self.admin)
        self.client.post("/api/admin/provision-staff/", self._batch(), format="json")
        batch = {"accounts": [{"username": "weighbridge.mur", "password": "Recovered!Pass-3",
                               "pin": "8642", "role": "weighing_clerk", "station": "MUR", "reset": True}]}
        r = self.client.post("/api/admin/provision-staff/", batch, format="json")
        self.assertEqual(r.json()["reset"], ["weighbridge.mur"])
        anon = APIClient()
        ok = anon.post("/api/auth/login/", {"username": "weighbridge.mur", "password": "Recovered!Pass-3"}, format="json")
        self.assertEqual(ok.status_code, 200)
