"""LLM tool definitions for Phase 1 (floor plan)."""
from __future__ import annotations
from llm.base import Tool


FLOORPLAN_DSL_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "units": {"type": "string", "enum": ["meters"]},
        "wall_height": {"type": "number"},
        "wall_thickness": {"type": "number"},
        "rooms": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "polygon": {
                        "type": "array",
                        "items": {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2},
                        "minItems": 3,
                    },
                },
                "required": ["id", "name", "polygon"],
            },
        },
        "openings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "kind": {"type": "string", "enum": ["door", "window"]},
                    "wall_segment": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "a": {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2},
                            "b": {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2},
                        },
                        "required": ["a", "b"],
                    },
                    "offset": {"type": "number"},
                    "width": {"type": "number"},
                    "height": {"type": "number"},
                    "sill": {"type": "number"},
                },
                "required": ["id", "kind", "wall_segment", "offset", "width"],
            },
        },
        "roof": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "style": {"type": "string", "enum": ["gable", "hip", "flat", "shed"]},
                "pitch_deg": {"type": "number"},
                "overhang": {"type": "number"},
            },
            "required": ["style", "pitch_deg"],
        },
    },
    "required": ["rooms", "wall_height", "wall_thickness", "roof"],
}


CREATE_FLOORPLAN = Tool(
    name="create_floorplan",
    description=(
        "Produce a complete single-story residential floor plan as structured JSON. "
        "All coordinates are in METERS. Rooms are arbitrary closed polygons (>=3 vertices, "
        "counter-clockwise). You may use rectangles, but you are ENCOURAGED to use L-shapes, "
        "T-shapes, hexagons, octagonal nooks, alcoves, angled walls, or any polygon that "
        "fits modern residential architecture. Polygons MAY be non-convex (concave). "
        "Place doors and at least one window per habitable room. Walls are deduced from room "
        "polygons; you only output rooms + openings + roof."
    ),
    input_schema=FLOORPLAN_DSL_SCHEMA,
)


EDIT_FLOORPLAN = Tool(
    name="edit_floorplan",
    description=(
        "Edit the existing floor plan by returning the FULL updated DSL (not a patch). "
        "Preserve existing room IDs when possible. Rooms remain arbitrary closed polygons in "
        "METERS — L-shapes, angled walls, and other non-rectangular forms are welcome."
    ),
    input_schema=FLOORPLAN_DSL_SCHEMA,
)
