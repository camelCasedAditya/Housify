from django.urls import path
from . import views

urlpatterns = [
    path("projects/", views.ProjectListCreate.as_view()),
    path("projects/<uuid:pk>/", views.ProjectDetail.as_view()),
    path("projects/<uuid:pk>/phase/<str:phase>/", views.phase_current),
    path("projects/<uuid:pk>/phase/<str:phase>/versions/", views.phase_versions),
    path("projects/<uuid:pk>/phase/<str:phase>/revert/<int:version>/", views.phase_revert),
    path("projects/<uuid:pk>/chat/<str:phase>/", views.chat_list),
]
