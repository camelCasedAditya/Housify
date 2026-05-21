from django.db import models


class PolyhavenAsset(models.Model):
    slug = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=64, blank=True, default="")
    tags = models.JSONField(default=list)
    dim_x = models.FloatField(default=0)
    dim_y = models.FloatField(default=0)
    dim_z = models.FloatField(default=0)
    thumb_url = models.URLField(blank=True, default="")
    glb_url = models.URLField(blank=True, default="")
    local_path = models.CharField(max_length=512, blank=True, default="")
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
