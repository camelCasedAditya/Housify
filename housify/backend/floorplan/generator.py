"""Phase-1 generator: turn a natural-language brief into a FloorPlan DSL document."""
from __future__ import annotations
import json
import logging
import re
from llm.factory import get_provider
from llm.base import Message
from llm.budget import guard_cost
from .tools import CREATE_FLOORPLAN
from .validator import validate_and_normalize

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


EXAMPLE_DSL = {
    "units": "meters",
    "wall_height": 2.7,
    "wall_thickness": 0.15,
    "rooms": [
        # L-shaped great room (living + dining): open-plan modern shape
        {"id": "great_room", "name": "great room", "polygon": [
            [0.0, 0.0], [8.0, 0.0], [8.0, 4.0], [5.0, 4.0], [5.0, 6.5], [0.0, 6.5]
        ]},
        # Kitchen tucks into the notch of the L
        {"id": "kitchen", "name": "kitchen", "polygon": [
            [5.0, 4.0], [8.0, 4.0], [8.0, 6.5], [5.0, 6.5]
        ]},
        # Bedroom with an angled bay-window wall (5 vertices, non-rectangular)
        {"id": "bed1", "name": "bedroom 1", "polygon": [
            [0.0, 6.5], [5.0, 6.5], [5.0, 9.5], [3.5, 10.7], [0.0, 10.7]
        ]},
        # Bathroom — rectangular is fine where it makes sense
        {"id": "bath", "name": "bathroom", "polygon": [
            [5.0, 6.5], [8.0, 6.5], [8.0, 10.7], [5.0, 10.7]
        ]},
    ],
    "openings": [
        {"id": "front_door", "kind": "door",
         "wall_segment": {"a": [0.0, 0.0], "b": [8.0, 0.0]},
         "offset": 3.5, "width": 0.9, "height": 2.1, "sill": 0.0},
        {"id": "great_window", "kind": "window",
         "wall_segment": {"a": [0.0, 0.0], "b": [0.0, 6.5]},
         "offset": 2.0, "width": 1.6, "height": 1.4, "sill": 0.9},
        {"id": "bed_window_angled", "kind": "window",
         "wall_segment": {"a": [5.0, 9.5], "b": [3.5, 10.7]},
         "offset": 0.3, "width": 1.2, "height": 1.2, "sill": 0.9},
        {"id": "bed_door", "kind": "door",
         "wall_segment": {"a": [0.0, 6.5], "b": [5.0, 6.5]},
         "offset": 1.0, "width": 0.9, "height": 2.1, "sill": 0.0},
    ],
    "roof": {"style": "gable", "pitch_deg": 30.0, "overhang": 0.4},
}


SYSTEM_PROMPT = f"""You are a residential architect. Given a natural-language brief, design a single-story house as a floor plan.

You MUST respond by calling the `create_floorplan` tool with the full DSL. Do NOT respond with prose.
NEVER output placeholder text like "x" or "0" — use real numeric coordinates in METERS.

Rules:
- All coordinates are real decimal METERS, e.g. 0.0, 4.5, 10.0 — NEVER strings, NEVER placeholders.
- Rooms are closed counter-clockwise polygons of [x, y] points with >=3 vertices.
- Rooms DO NOT need to be rectangles. You are ENCOURAGED to use L-shapes, T-shapes, hexagons,
  octagonal nooks, angled bay windows, alcoves, or any polygonal shape that fits the brief
  and modern residential architecture. Concave (non-convex) polygons are allowed.
- Use rectangles where they fit (e.g. tight bathrooms, closets), but feel free to use richer
  shapes for living spaces, primary bedrooms, open-plan areas, etc.
- Adjacent rooms share exact wall edges (vertices coincide along shared edges; no gaps, no overlap).
  When a room is concave, its "notch" should be filled by another room with a matching edge.
- Place one exterior front door, interior doors between connecting rooms, and at least one window per habitable room.
- Each opening's `wall_segment.a` and `wall_segment.b` MUST be the two endpoints of an EXISTING room edge
  (the edge can be diagonal/angled — not just axis-aligned). `offset` is meters from `a` toward `b`.
- Standard dims: door 0.9×2.1m, window 1.2×1.2m sill 0.9m, walls 0.15m thick × 2.7m tall.
- Roof default: gable, 30°, 0.4m overhang.

Here is a CONCRETE EXAMPLE of a valid DSL showing an L-shaped great room, an angled bay-window
bedroom, and rectangular service rooms (study this format and produce something appropriately
shaped for the user's brief — don't just copy these exact shapes):

{json.dumps(EXAMPLE_DSL, indent=2)}
"""


def _coerce_numbers(obj):
    """Recursively coerce numeric-looking strings to floats inside the DSL."""
    if isinstance(obj, dict):
        return {k: _coerce_numbers(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_coerce_numbers(x) for x in obj]
    if isinstance(obj, str):
        s = obj.strip()
        try:
            if s and (s.lstrip("-").replace(".", "", 1).isdigit()):
                return float(s) if "." in s else int(s)
        except Exception:
            pass
    return obj


def _extract_json_object(text: str) -> dict | None:
    """Best-effort: find the first balanced JSON object in arbitrary text."""
    if not text:
        return None
    s = text.strip()
    # Strip markdown fences
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```\s*$", "", s)
    # Try plain parse
    try:
        return json.loads(s)
    except Exception:
        pass
    # Locate first '{' and try shrinking from the end to find the matching '}'
    start = s.find("{")
    if start == -1:
        return None
    # Walk balanced braces from start
    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(s[start:], start=start):
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = s[start:i + 1]
                try:
                    return json.loads(candidate)
                except Exception:
                    return None
    return None


def _normalize_raw(raw: dict) -> dict:
    raw = _coerce_numbers(raw)
    raw.setdefault("units", "meters")
    raw.setdefault("wall_height", 2.7)
    raw.setdefault("wall_thickness", 0.15)
    raw.setdefault("roof", {"style": "gable", "pitch_deg": 30, "overhang": 0.4})
    raw.setdefault("openings", [])

    clean_rooms = []
    for r in (raw.get("rooms") or []):
        poly = r.get("polygon") or []
        if all(isinstance(p, (list, tuple)) and len(p) == 2 and
               all(isinstance(c, (int, float)) for c in p) for p in poly) and len(poly) >= 3:
            clean_rooms.append(r)
        else:
            log.warning("dropping malformed room %s polygon=%r", r.get("id"), poly)
    raw["rooms"] = clean_rooms
    return raw


def _one_call(provider, messages, attempt: int) -> tuple[dict | None, str, str | None]:
    """Returns (raw_dsl_or_None, debug_summary, error_message_or_None)."""
    result = provider.complete(messages, tools=[CREATE_FLOORPLAN], max_tokens=4096, temperature=0.2)
    summary = (
        f"attempt={attempt} tool_calls={len(result.tool_calls)} "
        f"text_len={len(result.text or '')} in={result.input_tokens} out={result.output_tokens}"
    )
    log.info(summary)

    if result.tool_calls:
        return result.tool_calls[0]["arguments"], summary, None

    parsed = _extract_json_object(result.text or "")
    if parsed and isinstance(parsed, dict) and parsed.get("rooms"):
        return parsed, summary + " (parsed from text)", None

    snippet = (result.text or "").strip()[:300] or "(empty)"
    return None, summary, f"no tool call and no parseable JSON. text snippet: {snippet!r}"


def generate_floorplan(brief: str) -> dict:
    provider = get_provider()
    est = provider.estimate_cost_usd(2500, 2500)
    guard_cost(est)

    base_user = f"BRIEF:\n{brief}\n\nCall the create_floorplan tool now."
    messages = [
        Message(role="system", content=SYSTEM_PROMPT),
        Message(role="user", content=base_user),
    ]

    last_err = None
    raw = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        raw, summary, err = _one_call(provider, messages, attempt)
        if raw is not None:
            log.info("got floor plan on %s", summary)
            break
        last_err = err
        log.warning("attempt %d failed: %s", attempt, err)
        # Add a corrective nudge for the next attempt
        messages = [
            Message(role="system", content=SYSTEM_PROMPT),
            Message(role="user", content=base_user),
            Message(role="assistant", content="(previous response was unusable)"),
            Message(
                role="user",
                content=(
                    "Your previous response did not call the create_floorplan tool. "
                    "You MUST call create_floorplan with a complete JSON object containing `rooms` "
                    "(list of objects with `id`, `name`, `polygon` of >=3 [x,y] number pairs in meters), "
                    "`openings`, `roof`, `wall_height`, `wall_thickness`. Do not write any prose. "
                    "Call the tool now."
                ),
            ),
        ]

    if raw is None:
        raise RuntimeError(
            f"LLM produced no usable floor plan after {MAX_ATTEMPTS} attempts. Last error: {last_err}"
        )

    return validate_and_normalize(_normalize_raw(raw))


def default_floorplan() -> dict:
    """A safe, deterministic 4-room plan used as a fallback when the LLM fails.

    The user can then chat to iterate on it. Keeps the project usable rather
    than showing an empty canvas.
    """
    doc = dict(EXAMPLE_DSL)
    # Mark it so the UI can hint the user to refine it
    doc["validation"] = {
        "warnings": [
            "LLM did not return a valid floor plan — showing a default starter plan. "
            "Use chat to describe what you actually want."
        ],
        "errors": [],
    }
    return validate_and_normalize(_normalize_raw(dict(doc)))
