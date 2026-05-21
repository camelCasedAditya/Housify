import { useMemo, useRef, useEffect, useState } from "react";
import { Stage, Layer, Line, Rect, Text, Group } from "react-konva";

interface Room { id: string; name: string; polygon: number[][]; }
interface Opening {
  id: string; kind: "door" | "window";
  wall_segment: { a: number[]; b: number[] };
  offset: number; width: number;
}
interface FloorPlan {
  rooms: Room[]; openings?: Opening[];
  wall_thickness?: number; bbox?: number[];
  validation?: { warnings: string[]; errors: string[] };
  error?: string;
}

const PAD = 40;

function bbox(rooms: Room[]) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const r of rooms) for (const [x, y] of r.polygon) {
    if (x < minx) minx = x; if (y < miny) miny = y;
    if (x > maxx) maxx = x; if (y > maxy) maxy = y;
  }
  if (!isFinite(minx)) return { minx: 0, miny: 0, maxx: 1, maxy: 1 };
  return { minx, miny, maxx, maxy };
}

function flatten(poly: number[][], to: (x: number, y: number) => [number, number]) {
  const out: number[] = [];
  for (const [x, y] of poly) { const [px, py] = to(x, y); out.push(px, py); }
  return out;
}

export default function FloorplanCanvas({ doc }: { doc: FloorPlan }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(() => {
      const el = wrap.current!;
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const { to, scale } = useMemo(() => {
    const b = bbox(doc.rooms || []);
    const dx = Math.max(0.001, b.maxx - b.minx);
    const dy = Math.max(0.001, b.maxy - b.miny);
    const sx = (size.w - PAD * 2) / dx;
    const sy = (size.h - PAD * 2) / dy;
    const s = Math.min(sx, sy);
    const ox = PAD + (size.w - PAD * 2 - dx * s) / 2 - b.minx * s;
    // Flip Y so model +Y is up on screen
    const oy = size.h - PAD - (size.h - PAD * 2 - dy * s) / 2 + b.miny * s;
    return {
      to: (x: number, y: number): [number, number] => [ox + x * s, oy - y * s],
      scale: s,
    };
  }, [doc, size]);

  const rooms = doc.rooms || [];
  const openings = doc.openings || [];

  return (
    <div ref={wrap} style={{ width: "100%", height: "100%", background: "#1a1d24", borderRadius: 8, position: "relative" }}>
      <Stage width={size.w} height={size.h}>
        <Layer listening={false}>
          {/* Rooms */}
          {rooms.map((r) => {
            const pts = flatten(r.polygon, to);
            const cx = r.polygon.reduce((a, p) => a + p[0], 0) / r.polygon.length;
            const cy = r.polygon.reduce((a, p) => a + p[1], 0) / r.polygon.length;
            const [lx, ly] = to(cx, cy);
            const area = polygonArea(r.polygon);
            return (
              <Group key={r.id}>
                <Line points={pts} closed fill="#22272f" stroke="#cbd2dc" strokeWidth={2} />
                <Text x={lx - 60} y={ly - 14} width={120} align="center" text={`${r.name}\n${area.toFixed(1)} m²`} fill="#cbd2dc" fontSize={13} />
              </Group>
            );
          })}
          {/* Dimension labels: room edges */}
          {rooms.flatMap((r) => r.polygon.map((p, i) => {
            const q = r.polygon[(i + 1) % r.polygon.length];
            const dx = q[0] - p[0], dy = q[1] - p[1];
            const len = Math.hypot(dx, dy);
            if (len < 0.3) return null;
            const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
            // outward normal (rough): rotate edge 90° clockwise scaled by 0.25m
            const nx = dy / len * 0.25, ny = -dx / len * 0.25;
            const [tx, ty] = to(mx + nx, my + ny);
            return (
              <Text key={`${r.id}-${i}`} x={tx - 20} y={ty - 7} width={40} align="center" text={`${len.toFixed(2)}m`} fill="#6b7280" fontSize={10} />
            );
          }))}
          {/* Openings */}
          {openings.map((op) => {
            const a = op.wall_segment.a, b = op.wall_segment.b;
            const dx = b[0] - a[0], dy = b[1] - a[1];
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len;
            const sx = a[0] + ux * op.offset;
            const sy = a[1] + uy * op.offset;
            const ex = sx + ux * op.width;
            const ey = sy + uy * op.width;
            const [p1x, p1y] = to(sx, sy);
            const [p2x, p2y] = to(ex, ey);
            const color = op.kind === "door" ? "#f6ad55" : "#63b3ed";
            return (
              <Line key={op.id} points={[p1x, p1y, p2x, p2y]} stroke={color} strokeWidth={4} lineCap="round" />
            );
          })}
        </Layer>
      </Stage>
      {doc.error || rooms.length === 0 ? (
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, background: "#3a1212", border: "1px solid #c53030", color: "#fed7d7", padding: "0.8rem 1rem", borderRadius: 6, fontSize: 13 }}>
          <strong>⚠ Floor plan generation issue</strong>
          <div style={{ marginTop: 4, opacity: 0.9 }}>
            {doc.error || "The LLM returned an empty plan. Try chatting to add rooms, or create a new project."}
          </div>
        </div>
      ) : null}
      {doc.validation?.warnings?.length ? (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, background: "#3a2a12", border: "1px solid #b7791f", color: "#fbd38d", padding: "0.6rem 0.8rem", borderRadius: 6, fontSize: 12 }}>
          {doc.validation.warnings.slice(0, 4).map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      ) : null}
    </div>
  );
}

function polygonArea(poly: number[][]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
