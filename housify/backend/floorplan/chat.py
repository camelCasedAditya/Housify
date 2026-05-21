"""Phase-1 chat editor — applies a user message to the current FloorPlan doc."""
from __future__ import annotations
import json
from llm.factory import get_provider
from llm.base import Message
from llm.budget import guard_cost
from .tools import EDIT_FLOORPLAN
from .validator import validate_and_normalize
from .generator import _coerce_numbers


SYSTEM_PROMPT = """You are an AI architect helping the user iterate on a single-story floor plan.

You receive the CURRENT_DSL (JSON) and a USER_MESSAGE describing the desired change.
Apply the change and respond by calling the `edit_floorplan` tool with the FULL updated DSL.

Rules:
- Coordinates in METERS.
- Preserve room IDs where possible. Reuse existing structure unless the user asks otherwise.
- Maintain valid topology: rooms touch without overlapping; openings lie on real wall segments.
- Standard dims unchanged unless asked: doors 0.9×2.1m, windows 1.2×1.2m (sill 0.9m), walls 0.15m thick, 2.7m tall.
- If the user is just asking a question (not requesting an edit), respond with text only and DO NOT call the tool."""


def edit_floorplan_with_chat(current_doc: dict, user_message: str):
    """Returns (assistant_text, new_doc_or_none, usage)."""
    provider = get_provider()
    est = provider.estimate_cost_usd(2500, 2500)
    guard_cost(est)

    messages = [
        Message(role="system", content=SYSTEM_PROMPT),
        Message(
            role="user",
            content=f"CURRENT_DSL:\n{json.dumps(current_doc)}\n\nUSER_MESSAGE:\n{user_message}",
        ),
    ]
    result = provider.complete(messages, tools=[EDIT_FLOORPLAN], max_tokens=4096, temperature=0.2)
    usage = {"input_tokens": result.input_tokens, "output_tokens": result.output_tokens}
    if not result.tool_calls:
        return result.text or "", None, usage
    raw = _coerce_numbers(result.tool_calls[0]["arguments"])
    raw.setdefault("units", "meters")
    raw.setdefault("wall_height", current_doc.get("wall_height", 2.7))
    raw.setdefault("wall_thickness", current_doc.get("wall_thickness", 0.15))
    raw.setdefault("roof", current_doc.get("roof") or {"style": "gable", "pitch_deg": 30, "overhang": 0.4})
    raw.setdefault("openings", [])
    new_doc = validate_and_normalize(raw)
    return result.text or "", new_doc, usage
