"""Roles & Permissions settings (2026-10-22): the admin-editable grant
matrix is stored on the Role row and drives live enforcement, while the
hard identity locks (roles, assignments, credentials) ignore the matrix.
"""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Role

PW = "MuragoAdmin2026!"


class RolePermissionMatrixTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        U = get_user_model()
        cls.admin = U.objects.get(username="admin")
        cls.weigher = U.objects.get(username="weigher1")
        cls.manager = U.objects.get(username="sitemanager")

    def as_user(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    def test_matrix_read_admin_only(self):
        r = self.as_user(self.admin).get("/api/admin/permission-matrix/")
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual(len(body["apps"]), 22)  # 21 original modules + hrm
        self.assertIn("hrm", [a["app"] for a in body["apps"]])
        clerk = [x for x in body["roles"] if x["code"] == "weighing_clerk"][0]
        self.assertIn("read", clerk["grants"]["farmers"])
        self.assertNotIn("payroll", clerk["grants"])
        self.assertTrue(body["locked"])
        r = self.as_user(self.manager).get("/api/admin/permission-matrix/")
        self.assertEqual(r.status_code, 403)

    def test_edit_changes_live_enforcement(self):
        admin = self.as_user(self.admin)
        clerk = self.as_user(self.weigher)
        # baseline: clerk can read farmers, cannot read buyers
        self.assertEqual(clerk.get("/api/farmers/").status_code, 200)
        self.assertEqual(clerk.get("/api/buyers/").status_code, 403)
        # admin removes farmers and grants buyers read via the settings API
        matrix = admin.get("/api/admin/permission-matrix/").json()
        grants = [x for x in matrix["roles"] if x["code"] == "weighing_clerk"][0]["grants"]
        del grants["farmers"]
        grants["buyers"] = ["read"]
        r = admin.put("/api/admin/permission-matrix/weighing_clerk/", {"grants": grants}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()["customized"])
        # a FRESH client (new request cycle) sees the new enforcement —
        # re-fetch the user, exactly as token auth does on every request
        clerk2 = self.as_user(get_user_model().objects.get(username="weigher1"))
        self.assertEqual(clerk2.get("/api/farmers/").status_code, 403)
        self.assertEqual(clerk2.get("/api/buyers/").status_code, 200)

    def test_admin_role_cannot_be_edited(self):
        r = self.as_user(self.admin).put("/api/admin/permission-matrix/admin/",
                                          {"grants": {}}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_non_admin_cannot_edit(self):
        r = self.as_user(self.manager).put("/api/admin/permission-matrix/weighing_clerk/",
                                           {"grants": {}}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_identity_locks_ignore_the_matrix(self):
        admin = self.as_user(self.admin)
        # even if the matrix grants 'core' write to the clerk, the identity
        # models stay admin-only (model overrides outrank the grant map)
        matrix = admin.get("/api/admin/permission-matrix/").json()
        grants = [x for x in matrix["roles"] if x["code"] == "weighing_clerk"][0]["grants"]
        grants["core"] = ["read", "write"]
        r = admin.put("/api/admin/permission-matrix/weighing_clerk/", {"grants": grants}, format="json")
        self.assertEqual(r.status_code, 200)
        clerk = self.as_user(self.weigher)
        self.assertEqual(clerk.get("/api/user-station-roles/").status_code, 403)
        r = clerk.post("/api/user-station-roles/", {}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(clerk.get("/api/stations/").status_code, 200)  # core read works

    def test_saved_grants_survive_reseed(self):
        admin = self.as_user(self.admin)
        matrix = admin.get("/api/admin/permission-matrix/").json()
        grants = [x for x in matrix["roles"] if x["code"] == "weighing_clerk"][0]["grants"]
        del grants["farmers"]
        admin.put("/api/admin/permission-matrix/weighing_clerk/", {"grants": grants}, format="json")
        call_command("seed_demo")  # runs on every boot — must not clobber admin edits
        role = Role.objects.get(code="weighing_clerk")
        self.assertIsInstance(role.permissions, dict)
        self.assertNotIn("farmers", role.permissions)
        clerk = self.as_user(self.weigher)
        self.assertEqual(clerk.get("/api/farmers/").status_code, 403)

    def test_defaults_match_builtin_matrix(self):
        from api.permissions import default_grants_for, role_grants
        role = Role.objects.get(code="finance_officer")
        if not (isinstance(role.permissions, dict) and role.permissions):
            self.assertEqual(role_grants(role), default_grants_for("finance_officer"))
        self.assertIn("write", default_grants_for("finance_officer")["payments"])
        self.assertNotIn("write", default_grants_for("finance_officer").get("finance", []))
