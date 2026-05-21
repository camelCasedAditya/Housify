"""Geometric validation for the FloorPlan DSL — pure Python (no shapely)."""
from __future__ import annotations
import math
from typing import Any


def _seg_contains_point(a, b, p, tol=0.05) -> bool:
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    seglen2 = dx * dx + dy * dy
    if seglen2 == 0:
        return math.hypot(px - ax, py - ay) <= tol
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seglen2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy) <= tol


def _polygon_area(poly):
    s = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def _point_in_polygon(p, poly) -> bool:
    """Ray-cast test."""
    x, y = p
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def _interior_sample(poly):
    """Return an (x, y) point likely to be inside `poly`.

    Centroid works for convex polygons but can land outside concave (e.g. L-shaped)
    ones. We also sample midpoints of edge pairs as fallbacks until we find a
    point that the ray-cast test considers inside. Returns None if nothing works.
    """
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    if _point_in_polygon((cx, cy), poly):
        return (cx, cy)
    # Try midpoints of (vertex_i, vertex_{i+2}) — diagonals skipping one edge.
    for i in range(n):
        j = (i + 2) % n
        mx = (poly[i][0] + poly[j][0]) / 2.0
        my = (poly[i][1] + poly[j][1]) / 2.0
        if _point_in_polygon((mx, my), poly):
            return (mx, my)
    return None


def _polygons_overlap(a, b) -> bool:
    """Approximate overlap check robust to concave polygons.

    Logic:
      1. If any vertex of one polygon is strictly inside (not just on the
         boundary of) the other, they overlap.
      2. As a fallback, if an interior sample of one polygon lies inside the
         other, they overlap. The interior sample is chosen so it actually lies
         inside its own polygon — this avoids false positives when an L-shaped
         room is properly tiled by another room filling its concave notch.
    """
    # any vertex of a strictly inside b, or vice versa
    for p in a:
        if _point_in_polygon(p, b):
            on_edge = any(
                _seg_contains_point(b[i], b[(i + 1) % len(b)], p, tol=0.01)
                for i in range(len(b))
            )
            if not on_edge:
                return True
    for p in b:
        if _point_in_polygon(p, a):
            on_edge = any(
                _seg_contains_point(a[i], a[(i + 1) % len(a)], p, tol=0.01)
                for i in range(len(a))
            )
            if not on_edge:
                return True
    # Interior-sample fallback — must be a point genuinely inside its own poly.
    sa = _interior_sample(a)
    if sa is not None and _point_in_polygon(sa, b):
        return True
    sb = _interior_sample(b)
    if sb is not None and _point_in_polygon(sb, a):
        return True
    return False


def _bbox_of(polys):
    minx = miny = math.inf
    maxx = maxy = -math.inf
    for poly in polys:
        for x, y in poly:
            if x < minx: minx = x
            if y < miny: miny = y
            if x > maxx: maxx = x
            if y > maxy: maxy = y
    if not math.isfinite(minx):
        return 0.0, 0.0, 0.0, 0.0
    return minx, miny, maxx, maxy


def validate_and_normalize(doc: dict[str, Any]) -> dict[str, Any]:
    warnings: list[str] = []
    errors: list[str] = []

    rooms = doc.get("rooms") or []
    valid_rooms: list[tuple[str, list]] = []
    for r in rooms:
        poly = r.get("polygon") or []
        # Defensive: must be all-numeric
        if not all(isinstance(p, (list, tuple)) and len(p) == 2 and
                   all(isinstance(c, (int, float)) for c in p) for p in poly):
            errors.append(f"room {r.get('id')} has non-numeric coordinates")
            continue
        if len(poly) < 3:
            errors.append(f"room {r.get('id')} has fewer than 3 vertices")
            continue
        valid_rooms.append((r.get("id"), poly))

    for i in range(len(valid_rooms)):
        for j in range(i + 1, len(valid_rooms)):
            a_id, a = valid_rooms[i]
            b_id, b = valid_rooms[j]
            if _polygons_overlap(a, b):
                warnings.append(f"rooms {a_id} and {b_id} overlap")

    # opening alignment
    edges = []
    for rid, poly in valid_rooms:
        for i in range(len(poly)):
            edges.append((rid, poly[i], poly[(i + 1) % len(poly)]))

    for op in (doc.get("openings") or []):
        seg = op.get("wall_segment") or {}
        a = seg.get("a"); b = seg.get("b")
        if not (a and b and len(a) == 2 and len(b) == 2 and
                all(isinstance(c, (int, float)) for c in (*a, *b))):
            errors.append(f"opening {op.get('id')} has invalid wall_segment")
            continue
        found = False
        for _rid, ea, eb in edges:
            if (_seg_contains_point(ea, eb, a) and _seg_contains_point(ea, eb, b)) or \
               (_seg_contains_point(ea, eb, b) and _seg_contains_point(ea, eb, a)):
                found = True
                break
        if not found:
            warnings.append(f"opening {op.get('id')} not aligned with any room wall")
        seglen = math.hypot(b[0] - a[0], b[1] - a[1])
        off = op.get("offset", 0) or 0
        wid = op.get("width", 0) or 0
        if off + wid > seglen + 1e-3:
            warnings.append(f"opening {op.get('id')} extends beyond its wall segment")

    if valid_rooms:
        minx, miny, maxx, maxy = _bbox_of([p for _i, p in valid_rooms])
        doc["bbox"] = [round(maxx - minx, 3), round(maxy - miny, 3)]
    else:
        doc["bbox"] = [0.0, 0.0]

    doc["validation"] = {"warnings": warnings, "errors": errors}
    return doc
