from django.urls import path, include

urlpatterns = [
    path("api/", include("projects.urls")),
    path("api/", include("floorplan.urls")),
    path("api/", include("polyhaven.urls")),
]
