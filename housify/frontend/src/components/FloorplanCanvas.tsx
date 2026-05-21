import { useMemo, useRef, useEffect, useState } from "react";
import { Stage, Layer, Line, Text, Group, Arc } from "react-konva";

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

const PAD = 52;
const MONO = "'IBM Plex Mono', monospace";

// Blueprint palette — all walls share the same crisp white-blue line,
// rooms differentiated by subtle fills only.
const BLUEPRINT_ROOMS: { keywords: string[]; fill: string; text: string }[] = [
  { keywords: ["living", "lounge", "great", "family"], fill: "rgba(96,165,250,0.14)",   text: "#93c5fd" },
  { keywords: ["kitchen", "cook"],                     fill: "rgba(251,191,36,0.1)",    text: "#fde68a" },
  { keywords: ["master", "primary"],                   fill: "rgba(167,139,250,0.15)",  text: "#c4b5fd" },
  { keywords: ["bedroom", "bed"],                      fill: "rgba(147,197,253,0.12)",  text: "#bfdbfe" },
  { keywords: ["bath", "toilet", "wc", "shower", "ensuite"], fill: "rgba(34,211,238,0.1)", text: "#a5f3fc" },
  { keywords: ["dining"],                              fill: "rgba(244,114,182,0.1)",   text: "#f9a8d4" },
  { keywords: ["office", "study", "work"],             fill: "rgba(251,146,60,0.1)",    text: "#fed7aa" },
  { keywords: ["garage", "carport"],                   fill: "rgba(100,116,139,0.14)",  text: "#94a3b8" },
  { keywords: ["porch", "deck", "patio"],              fill: "rgba(74,222,128,0.1)",    text: "#bbf7d0" },
  { keywords: ["entry", "foyer", "mudroom"],           fill: "rgba(52,211,153,0.1)",    text: "#a7f3d0" },
  { keywords: ["hall", "corridor", "stair", "landing"],fill: "rgba(129,140,248,0.08)", text: "#c7d2fe" },
  { keywords: ["laundry", "utility"],                  fill: "rgba(232,121,249,0.08)",  text: "#f5d0fe" },
  { keywords: ["closet", "pantry", "storage"],         fill: "rgba(217,119,6,0.09)",    text: "#fde68a" },
];

function getRoomStyle(name: string) {
  const n = name.toLowerCase();
  for (const p of BLUEPRINT_ROOMS) {
    if (p.keywords.some((k) => n.includes(k))) return { fill: p.fill, text: p.text };
  }
  return { fill: "rgba(91,155,213,0.08)", text: "#93c5fd" };
}

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
  const pts: number[] = [];
  for (const [x, y] of poly) { const [px, py] = to(x, y); pts.push(px, py); }
  return pts;
}

function polygonArea(poly: number[][]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function centroid(poly: number[][]): [number, number] {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  return [cx / poly.length, cy / poly.length];
}

export default function FloorplanCanvas({ doc, version }: { doc: FloorPlan; version?: number }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(() => {
      const el = wrap.current!;
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const { to } = useMemo(() => {
    const b = bbox(doc.rooms || []);
    const dx = Math.max(0.001, b.maxx - b.minx);
    const dy = Math.max(0.001, b.maxy - b.miny);
    const s = Math.min((size.w - PAD * 2) / dx, (size.h - PAD * 2) / dy);
    const ox = PAD + (size.w - PAD * 2 - dx * s) / 2 - b.minx * s;
    const oy = size.h - PAD - (size.h - PAD * 2 - dy * s) / 2 + b.miny * s;
    return { to: (x: number, y: number): [number, number] => [ox + x * s, oy - y * s] };
  }, [doc, size]);

  const rooms = doc.rooms || [];
  const openings = doc.openings || [];
  const warnings = doc.validation?.warnings ?? [];
  const errors = doc.validation?.errors ?? [];

  function downloadPNG() {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = "housify-floorplan.png";
    a.click();
  }

  // Blueprint wall color — the defining visual element
  const WALL  = "rgba(180, 215, 248, 0.88)";
  const DIM   = "rgba(91, 155, 213, 0.35)";
  const DOOR  = "rgba(255, 210, 140, 0.9)";
  const WIN   = "rgba(147, 197, 253, 0.9)";

  return (
    <div
      ref={wrap}
      className="blueprint-canvas"
      style={{
        width: "100%", height: "100%",
        position: "relative",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      <Stage ref={stageRef} width={size.w} height={size.h}>
        <Layer listening={false}>
          {rooms.map((r) => {
            const style = getRoomStyle(r.name);
            const pts = flatten(r.polygon, to);
            const [cx, cy] = centroid(r.polygon);
            const [lx, ly] = to(cx, cy);
            const area = polygonArea(r.polygon);

            return (
              <Group key={r.id}>
                {/* Room fill */}
                <Line points={pts} closed fill={style.fill} stroke={WALL} strokeWidth={2} />

                {/* Room name */}
                <Text
                  x={lx - 58} y={ly - 15}
                  width={116} align="center"
                  text={r.name.toUpperCase()}
                  fill={style.text}
                  fontSize={10}
                  fontFamily={MONO}
                  fontStyle="500"
                  letterSpacing={1.5}
                />
                {/* Area */}
                <Text
                  x={lx - 40} y={ly + 3}
                  width={80} align="center"
                  text={`${area.toFixed(1)} m²`}
                  fill={DIM}
                  fontSize={9}
                  fontFamily={MONO}
                />
              </Group>
            );
          })}

          {/* Dimension labels */}
          {rooms.flatMap((r) =>
            r.polygon.map((p, i) => {
              const q = r.polygon[(i + 1) % r.polygon.length];
              const dx = q[0] - p[0], dy = q[1] - p[1];
              const len = Math.hypot(dx, dy);
              if (len < 0.4) return null;
              const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
              const nx = dy / len * 0.32, ny = -dx / len * 0.32;
              const [tx, ty] = to(mx + nx, my + ny);
              return (
                <Text
                  key={`${r.id}-${i}`}
                  x={tx - 22} y={ty - 7}
                  width={44} align="center"
                  text={`${len.toFixed(1)}`}
                  fill="rgba(91,155,213,0.28)"
                  fontSize={8}
                  fontFamily={MONO}
                />
              );
            })
          )}

          {/* Openings */}
          {openings.map((op) => {
            const a = op.wall_segment.a, b = op.wall_segment.b;
            const wdx = b[0] - a[0], wdy = b[1] - a[1];
            const wlen = Math.hypot(wdx, wdy) || 1;
            const ux = wdx / wlen, uy = wdy / wlen;
            const sx = a[0] + ux * op.offset, sy = a[1] + uy * op.offset;
            const ex = sx + ux * op.width, ey = sy + uy * op.width;
            const [p1x, p1y] = to(sx, sy);
            const [p2x, p2y] = to(ex, ey);

            if (op.kind === "window") {
              return (
                <Group key={op.id}>
                  <Line points={[p1x, p1y, p2x, p2y]} stroke={WIN} strokeWidth={5} lineCap="round" opacity={0.75} />
                  <Line points={[p1x, p1y, p2x, p2y]} stroke="rgba(6,15,30,0.6)" strokeWidth={2} lineCap="round" />
                </Group>
              );
            }

            const doorLen = Math.hypot(p2x - p1x, p2y - p1y);
            const angleDeg = Math.atan2(p2y - p1y, p2x - p1x) * 180 / Math.PI;

            return (
              <Group key={op.id}>
                <Line points={[p1x, p1y, p2x, p2y]} stroke={DOOR} strokeWidth={2.5} lineCap="round" />
                <Arc
                  x={p1x} y={p1y}
                  innerRadius={0}
                  outerRadius={doorLen}
                  angle={85}
                  rotation={angleDeg}
                  stroke={DOOR}
                  strokeWidth={1}
                  fill="rgba(255,210,140,0.05)"
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* TOP-RIGHT CONTROLS */}
      <div style={{
        position: "absolute", top: 10, right: 10,
        display: "flex", gap: "0.4rem", alignItems: "center",
      }}>
        {version != null && (
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--accent-dim)",
            background: "rgba(6,9,15,0.9)",
            border: "1px solid rgba(91,155,213,0.2)",
            padding: "3px 8px",
            borderRadius: 3,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            V{version}
          </span>
        )}
        <button
          onClick={downloadPNG}
          className="btn-ghost"
          style={{
            fontSize: 9,
            padding: "0.3rem 0.7rem",
            borderRadius: 3,
            background: "rgba(6,9,15,0.9)",
            backdropFilter: "blur(4px)",
            letterSpacing: "0.1em",
          }}
        >
          ↓ EXPORT PNG
        </button>
      </div>

      {/* BOTTOM-LEFT LEGEND */}
      {rooms.length > 0 && (
        <div style={{
          position: "absolute", bottom: 10, left: 10,
          display: "flex", flexWrap: "wrap", gap: 4,
          maxWidth: "60%",
        }}>
          {rooms.map((r) => {
            const style = getRoomStyle(r.name);
            return (
              <span key={r.id} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(6,9,15,0.88)",
                border: `1px solid rgba(91,155,213,0.15)`,
                color: style.text,
                padding: "2px 7px",
                borderRadius: 3,
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                backdropFilter: "blur(4px)",
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: 1,
                  background: style.text, opacity: 0.7,
                  display: "inline-block", flexShrink: 0,
                }} />
                {r.name}
              </span>
            );
          })}
        </div>
      )}

      {/* WARNINGS — collapsed badge */}
      {warnings.length > 0 && (
        <div style={{ position: "absolute", bottom: 10, right: 10 }}>
          <button
            className="btn-ghost"
            onClick={() => setShowWarnings((s) => !s)}
            style={{
              fontSize: 9,
              padding: "0.25rem 0.6rem",
              borderRadius: 3,
              background: "rgba(6,9,15,0.9)",
              borderColor: "rgba(212,168,58,0.3)",
              color: "var(--yellow)",
              letterSpacing: "0.1em",
            }}
          >
            ⚠ {warnings.length} {showWarnings ? "▲" : "▼"}
          </button>
          {showWarnings && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", right: 0,
              background: "rgba(6,9,15,0.95)",
              border: "1px solid var(--yellow-border)",
              color: "var(--yellow)",
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              width: 280,
              backdropFilter: "blur(8px)",
              animation: "fade-up 0.15s ease",
            }}>
              {warnings.map((w, i) => <div key={i} style={{ lineHeight: 1.7 }}>⚠ {w}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ERROR */}
      {(doc.error || (rooms.length === 0 && !doc.validation)) && (
        <div style={{
          position: "absolute", top: 10, left: 10, right: 10,
          background: "var(--red-bg)",
          border: "1px solid var(--red-border)",
          color: "#fca5a5",
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-sm)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        }}>
          <strong style={{ letterSpacing: "0.08em" }}>GENERATION ERROR</strong>
          <div style={{ marginTop: 4, opacity: 0.8, fontStyle: "italic" }}>
            {doc.error || "Empty plan. Try chatting to add rooms, or create a new project."}
          </div>
        </div>
      )}
    </div>
  );
}
