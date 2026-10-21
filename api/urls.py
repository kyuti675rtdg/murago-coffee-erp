from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import auth_views, views

router = DefaultRouter()
for route, vs in views.build_viewsets().items():
    router.register(route, vs, basename=route)

urlpatterns = [
    path("auth/login/", auth_views.login),
    path("auth/logout/", auth_views.logout),
    path("auth/me/", auth_views.me),
    path("users/", auth_views.users_list),
    path("dashboard/", views.dashboard),
    path("postgis/", views.postgis_status),
    path("backups/", views.backups_list),
    path("reports/run/", views.run_report),
    path("lot-costing/<uuid:lot_id>/", views.lot_costing),
    path("sync/push/", views.sync_push),
    path("sync/pull/", views.sync_pull),
    path("", include(router.urls)),
]
