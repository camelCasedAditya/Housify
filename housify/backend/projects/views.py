from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Project, PhaseDoc, ChatTurn
from .serializers import ProjectSerializer, PhaseDocSerializer, ChatTurnSerializer
from .services import get_current_doc, save_new_version
from floorplan.generator import generate_floorplan, default_floorplan


class ProjectListCreate(generics.ListCreateAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    def create(self, request, *args, **kwargs):
        brief = (request.data.get("brief") or "").strip()
        title = (request.data.get("title") or "Untitled house").strip()
        if not brief:
            return Response({"detail": "brief is required"}, status=400)
        project = Project.objects.create(title=title, brief=brief)
        # Kick off Phase-1 generation synchronously (small, fast).
        try:
            dsl = generate_floorplan(brief)
            save_new_version(project, "floorplan", dsl)
        except Exception as e:  # noqa: BLE001
            # LLM failed after retries — fall back to a deterministic default
            # plan so the user has something to iterate on via chat.
            fallback = default_floorplan()
            fallback.setdefault("validation", {"warnings": [], "errors": []})
            fallback["validation"]["warnings"].insert(
                0, f"Initial generation failed ({e}). Showing a default plan — chat to refine it."
            )
            save_new_version(project, "floorplan", fallback)
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class ProjectDetail(generics.RetrieveDestroyAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


@api_view(["GET"])
def phase_current(request, pk, phase):
    project = Project.objects.get(pk=pk)
    pd = get_current_doc(project, phase)
    if not pd:
        return Response({"detail": "no document yet"}, status=404)
    return Response(PhaseDocSerializer(pd).data)


@api_view(["GET"])
def phase_versions(request, pk, phase):
    project = Project.objects.get(pk=pk)
    qs = PhaseDoc.objects.filter(project=project, phase=phase).order_by("-version")
    return Response(PhaseDocSerializer(qs, many=True).data)


@api_view(["POST"])
def phase_revert(request, pk, phase, version):
    project = Project.objects.get(pk=pk)
    src = PhaseDoc.objects.filter(project=project, phase=phase, version=version).first()
    if not src:
        return Response({"detail": "version not found"}, status=404)
    new = save_new_version(project, phase, src.doc, parent_version=src.version)
    return Response(PhaseDocSerializer(new).data, status=201)


@api_view(["GET"])
def chat_list(request, pk, phase):
    project = Project.objects.get(pk=pk)
    qs = ChatTurn.objects.filter(project=project, phase=phase).order_by("created_at")
    return Response(ChatTurnSerializer(qs, many=True).data)
