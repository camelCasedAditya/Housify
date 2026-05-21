from django.urls import path
from . import views

urlpatterns = [
    path("projects/<uuid:pk>/chat/floorplan/", views.chat_message),
    path("projects/<uuid:pk>/chat/floorplan/stream/", views.chat_stream),
]
