import uuid
from django.db import models


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, default="Untitled house")
    brief = models.TextField(blank=True, default="")
    units = models.CharField(max_length=16, default="meters")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class PhaseDoc(models.Model):
    PHASE_CHOICES = [
        ("floorplan", "floorplan"),
        ("scene3d", "scene3d"),
        ("furnish", "furnish"),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="phase_docs")
    phase = models.CharField(max_length=16, choices=PHASE_CHOICES)
    version = models.PositiveIntegerField()
    doc = models.JSONField()
    parent_version = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("project", "phase", "version")
        ordering = ["-version"]


class ChatTurn(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="chat_turns")
    phase = models.CharField(max_length=16)
    role = models.CharField(max_length=16)  # 'user' | 'assistant' | 'tool' | 'system'
    content = models.TextField(blank=True, default="")
    tool_calls = models.JSONField(null=True, blank=True)
    resulting_patch = models.JSONField(null=True, blank=True)
    resulting_version = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
