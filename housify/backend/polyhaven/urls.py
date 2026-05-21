from django.urls import path
from . import views

urlpatterns = [
    path("polyhaven/search/", views.search),
]
