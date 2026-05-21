from rest_framework import serializers
from .models import Project, PhaseDoc, ChatTurn


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "title", "brief", "units", "created_at", "updated_at"]


class PhaseDocSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhaseDoc
        fields = ["id", "phase", "version", "doc", "parent_version", "created_at"]


class ChatTurnSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatTurn
        fields = [
            "id", "phase", "role", "content", "tool_calls",
            "resulting_patch", "resulting_version", "created_at",
        ]
