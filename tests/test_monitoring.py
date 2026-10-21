"""Site Monitoring: the 8-camera wall is seeded, listed, and real cameras
can be registered (HLS) and removed through the API."""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient


class SiteMonitoringTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo")
        cls.admin = get_user_model().objects.get(username="admin")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_eight_demo_cameras_seeded(self):
        r = self.client.get("/api/site-cameras/")
        self.assertEqual(r.status_code, 200)
        rows = r.json()["results"]
        self.assertEqual(len(rows), 8)
        self.assertTrue(all(x["stream_type"] == "demo" and x["status"] == "demo" for x in rows))
        names = " ".join(x["name"] for x in rows)
        for expected in ("Weighbridge", "Pulping", "Fermentation", "Drying Beds", "Bensa", "Warehouse", "Dispatch"):
            self.assertIn(expected, names)

    def test_register_real_hls_camera(self):
        stations = self.client.get("/api/stations/").json()["results"]
        mur = [s for s in stations if s["code"] == "MUR"][0]
        r = self.client.post("/api/site-cameras/", {
            "station": mur["id"], "name": "CAM 09 — Gate (real)", "area": "Main gate",
            "stream_type": "hls", "stream_url": "https://nvr.example.et/cam9/index.m3u8",
            "status": "online", "sort_order": 9, "is_active": True}, format="json")
        self.assertEqual(r.status_code, 201)
        cam_id = r.json()["id"]
        self.assertEqual(r.json()["stream_type"], "hls")
        r = self.client.delete(f"/api/site-cameras/{cam_id}/")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.client.get("/api/site-cameras/").json()["count"], 8)
