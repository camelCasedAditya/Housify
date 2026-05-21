"""FloorPlan DSL — single canonical schema for Phase 1.

Single-story for v1. All units in meters.
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


class Room(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str  # e.g. "living", "kitchen", "bed1"
    polygon: list[list[float]] = Field(
        ..., description="Closed CCW polygon as [[x,y],...] in meters."
    )


class WallSegment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    a: list[float]  # [x, y]
    b: list[float]  # [x, y]


class Opening(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    kind: Literal["door", "window"]
    wall_segment: WallSegment
    offset: float = Field(..., description="Meters from segment.a toward segment.b")
    width: float
    height: float = 2.1
    sill: float = 0.0  # height above floor (0 for doors)


class Roof(BaseModel):
    model_config = ConfigDict(extra="forbid")
    style: Literal["gable", "hip", "flat", "shed"] = "gable"
    pitch_deg: float = 30.0
    overhang: float = 0.4


class Validation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class FloorPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    units: Literal["meters"] = "meters"
    bbox: list[float] = Field(default_factory=lambda: [0.0, 0.0])
    wall_height: float = 2.7
    wall_thickness: float = 0.15
    rooms: list[Room]
    openings: list[Opening] = Field(default_factory=list)
    roof: Roof = Field(default_factory=Roof)
    validation: Optional[Validation] = None
