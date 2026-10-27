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
    path("admin/provision-staff/", auth_views.provision_staff),
    path("admin/permission-matrix/", auth_views.permission_matrix),
    path("admin/permission-matrix/<str:role_code>/", auth_views.permission_matrix_update),
    path("dashboard/", views.dashboard),
    path("hr-dashboard/", views.hr_dashboard),
    path("site-performance/", views.site_performance),
    path("site-performance/<uuid:station_id>/", views.site_performance_detail),
    path("postgis/", views.postgis_status),
    path("backups/", views.backups_list),
    path("reports/run/", views.run_report),
    path("lot-costing/<uuid:lot_id>/", views.lot_costing),
    path("sync/push/", views.sync_push),
    path("sync/pull/", views.sync_pull),
    path("", include(router.urls)),
]
