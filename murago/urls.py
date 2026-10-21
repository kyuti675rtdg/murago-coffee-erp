from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, HttpResponse, JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(_request):
    return JsonResponse({"service": "murago-coffee-erp", "phase": 3, "status": "ok"})


def spa(_request, _path=""):
    dist = Path(settings.BASE_DIR) / "frontend" / "dist"
    # Serve real built assets (JS/CSS/manifest/sw/icon) when the file exists.
    if _path:
        candidate = (dist / _path).resolve()
        if candidate.is_file() and str(candidate).startswith(str(dist.resolve())):
            import mimetypes
            ctype = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
            return FileResponse(open(candidate, "rb"), content_type=ctype)
    index = dist / "index.html"
    if index.exists():
        return FileResponse(open(index, "rb"), content_type="text/html")
    return HttpResponse("<h1>Murago Coffee ERP</h1><p>Frontend not built yet. "
                        "Run: cd frontend && npm install && npm run build</p>", status=200)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/", include("api.urls")),
    path("app/", spa),
    re_path(r"^app/(?P<_path>.*)$", spa),
    path("", lambda r: __import__("django.shortcuts", fromlist=["redirect"]).redirect("/app/")),
]
