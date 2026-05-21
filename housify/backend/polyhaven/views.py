from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import PolyhavenAsset


@api_view(["GET"])
def search(request):
    q = (request.GET.get("q") or "").strip().lower()
    qs = PolyhavenAsset.objects.all()
    if q:
        qs = qs.filter(name__icontains=q)
    qs = qs[:50]
    return Response([
        {"slug": a.slug, "name": a.name, "category": a.category, "tags": a.tags,
         "dim_x": a.dim_x, "dim_y": a.dim_y, "dim_z": a.dim_z,
         "thumb_url": a.thumb_url}
        for a in qs
    ])
