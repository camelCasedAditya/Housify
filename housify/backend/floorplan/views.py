import json
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view
from rest_framework.response import Response

from projects.models import Project, ChatTurn
from projects.services import get_current_doc, save_new_version
from .chat import edit_floorplan_with_chat


@api_view(["POST"])
def chat_message(request, pk):
    """Non-streaming chat for Phase 1.

    POST body: {"message": "..."}
    Returns: {assistant_text, new_version|null, new_doc|null}
    """
    project = Project.objects.get(pk=pk)
    message = (request.data.get("message") or "").strip()
    if not message:
        return Response({"detail": "message is required"}, status=400)

    ChatTurn.objects.create(project=project, phase="floorplan", role="user", content=message)
    current = get_current_doc(project, "floorplan")
    current_doc = current.doc if current else {"rooms": [], "openings": [], "roof": {"style": "gable", "pitch_deg": 30, "overhang": 0.4}, "wall_height": 2.7, "wall_thickness": 0.15, "units": "meters"}

    try:
        text, new_doc, usage = edit_floorplan_with_chat(current_doc, message)
    except Exception as e:  # noqa: BLE001
        ChatTurn.objects.create(project=project, phase="floorplan", role="assistant", content=f"[error] {e}")
        return Response({"assistant_text": str(e), "new_version": None, "new_doc": None}, status=500)

    new_version_no = None
    if new_doc is not None:
        pd = save_new_version(project, "floorplan", new_doc, parent_version=current.version if current else None)
        new_version_no = pd.version

    ChatTurn.objects.create(
        project=project, phase="floorplan", role="assistant",
        content=text, resulting_version=new_version_no,
    )
    return Response({
        "assistant_text": text,
        "new_version": new_version_no,
        "new_doc": new_doc,
        "usage": usage,
    })


@csrf_exempt
@require_http_methods(["POST"])
def chat_stream(request, pk):
    """SSE streaming chat for Phase 1.

    Emits events:
      event: token   data: {"text": "..."}
      event: tool    data: {"name": "edit_floorplan"}
      event: result  data: {"new_version": int|null, "new_doc": {...}|null, "assistant_text": "..."}
      event: error   data: {"message": "..."}
      event: done    data: {}
    """
    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "invalid json"}, status=400)
    message = (body.get("message") or "").strip()
    if not message:
        return JsonResponse({"detail": "message is required"}, status=400)

    project = Project.objects.get(pk=pk)
    ChatTurn.objects.create(project=project, phase="floorplan", role="user", content=message)

    current = get_current_doc(project, "floorplan")
    current_doc = current.doc if current else {}

    def event(evt: str, data: dict):
        return f"event: {evt}\ndata: {json.dumps(data)}\n\n"

    def gen():
        from llm.factory import get_provider
        from llm.base import Message as LMsg
        from .tools import EDIT_FLOORPLAN
        from .chat import SYSTEM_PROMPT
        from .validator import validate_and_normalize

        provider = get_provider()
        messages = [
            LMsg(role="system", content=SYSTEM_PROMPT),
            LMsg(role="user", content=f"CURRENT_DSL:\n{json.dumps(current_doc)}\n\nUSER_MESSAGE:\n{message}"),
        ]
        text_buf = []
        tool_args = None
        try:
            for ev in provider.stream(messages, tools=[EDIT_FLOORPLAN], max_tokens=4096, temperature=0.2):
                if ev["type"] == "delta":
                    text_buf.append(ev["text"])
                    yield event("token", {"text": ev["text"]})
                elif ev["type"] == "tool_call":
                    tool_args = ev.get("arguments") or {}
                    yield event("tool", {"name": ev.get("name")})
                elif ev["type"] == "done":
                    pass
                elif ev["type"] == "error":
                    yield event("error", {"message": ev.get("message", "unknown")})
        except Exception as e:  # noqa: BLE001
            yield event("error", {"message": str(e)})
            yield event("done", {})
            return

        new_version_no = None
        new_doc = None
        if tool_args:
            from .generator import _coerce_numbers
            tool_args = _coerce_numbers(tool_args)
            tool_args.setdefault("units", "meters")
            tool_args.setdefault("wall_height", current_doc.get("wall_height", 2.7))
            tool_args.setdefault("wall_thickness", current_doc.get("wall_thickness", 0.15))
            tool_args.setdefault("roof", current_doc.get("roof") or {"style": "gable", "pitch_deg": 30, "overhang": 0.4})
            tool_args.setdefault("openings", [])
            try:
                new_doc = validate_and_normalize(tool_args)
                pd = save_new_version(project, "floorplan", new_doc, parent_version=current.version if current else None)
                new_version_no = pd.version
            except Exception as e:  # noqa: BLE001
                yield event("error", {"message": f"validation failed: {e}"})

        text_full = "".join(text_buf)
        ChatTurn.objects.create(
            project=project, phase="floorplan", role="assistant",
            content=text_full, resulting_version=new_version_no,
        )
        yield event("result", {
            "new_version": new_version_no,
            "new_doc": new_doc,
            "assistant_text": text_full,
        })
        yield event("done", {})

    response = StreamingHttpResponse(gen(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
