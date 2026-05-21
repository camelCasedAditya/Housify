import { useProject } from "../store/project";

interface Room { id: string; name: string; polygon: number[][]; }

function polygonArea(poly: number[][]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

const ROOM_PALETTE: { keywords: string[]; color: string }[] = [
  { keywords: ["living", "lounge", "great", "family"], color: "#60a5fa" },
  { keywords: ["kitchen", "cook"],                     color: "#fde68a" },
  { keywords: ["master", "primary"],                   color: "#c4b5fd" },
  { keywords: ["bedroom", "bed"],                      color: "#bfdbfe" },
  { keywords: ["bath", "toilet", "wc", "shower"],      color: "#a5f3fc" },
  { keywords: ["dining"],                              color: "#f9a8d4" },
  { keywords: ["office", "study", "work"],             color: "#fed7aa" },
  { keywords: ["garage", "carport"],                   color: "#94a3b8" },
  { keywords: ["porch", "deck", "patio"],              color: "#bbf7d0" },
  { keywords: ["entry", "foyer", "mudroom"],           color: "#a7f3d0" },
  { keywords: ["hall", "corridor", "stair"],           color: "#c7d2fe" },
  { keywords: ["laundry", "utility"],                  color: "#f5d0fe" },
  { keywords: ["closet", "pantry", "storage"],         color: "#fde68a" },
];

function getRoomColor(name: string) {
  const n = name.toLowerCase();
  for (const p of ROOM_PALETTE) {
    if (p.keywords.some((k) => n.includes(k))) return p.color;
  }
  return "#93c5fd";
}

function countByKeywords(rooms: Room[], keywords: string[]) {
  return rooms.filter((r) => keywords.some((k) => r.name.toLowerCase().includes(k))).length;
}

export default function StatsPanel() {
  const doc = useProject((s) => s.phaseDoc.floorplan);
  const fp = doc?.doc;

  if (!fp || !fp.rooms?.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", color: "var(--text-dim)", fontSize: 11,
        fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
        textAlign: "center", padding: "2rem",
      }}>
        Generate a floor plan<br />to see statistics.
      </div>
    );
  }

  const rooms: Room[] = fp.rooms;
  const roomStats = rooms
    .map((r) => ({ name: r.name, area: polygonArea(r.polygon), color: getRoomColor(r.name) }))
    .sort((a, b) => b.area - a.area);

  const totalArea = roomStats.reduce((s, r) => s + r.area, 0);
  const beds  = countByKeywords(rooms, ["bedroom", "bed", "master", "primary"]);
  const baths = countByKeywords(rooms, ["bath", "toilet", "wc", "shower", "ensuite"]);
  const maxArea = roomStats[0]?.area || 1;

  const summaryStats = [
    { label: "TOTAL AREA",  value: `${totalArea.toFixed(1)} m²` },
    { label: "ROOMS",       value: String(rooms.length) },
    { label: "BEDROOMS",    value: String(beds) },
    { label: "BATHROOMS",   value: String(baths) },
  ];

  return (
    <div style={{
      height: "100%",
      overflowY: "auto",
      padding: "0.75rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
    }}>

      {/* Summary grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.5rem",
      }}>
        {summaryStats.map(({ label, value }) => (
          <div key={label} style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.6rem 0.75rem",
          }}>
            <div style={{
              fontSize: 8,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-dim)",
              marginBottom: 4,
              textTransform: "uppercase",
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--accent)",
              lineHeight: 1,
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{
        fontSize: 9,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.16em",
        color: "var(--text-dim)",
        textTransform: "uppercase",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}>
        Room Breakdown
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      {/* Room breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {roomStats.map(({ name, area, color }) => {
          const pct = totalArea > 0 ? (area / totalArea) * 100 : 0;
          const barPct = (area / maxArea) * 100;

          return (
            <div key={name}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 4,
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color,
                }}>
                  {name}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                }}>
                  {area.toFixed(1)} m² · {pct.toFixed(0)}%
                </span>
              </div>
              {/* Bar track */}
              <div style={{
                height: 3,
                background: "var(--border)",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${barPct}%`,
                  background: color,
                  borderRadius: 2,
                  opacity: 0.7,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Wall height + units if available */}
      {fp.wall_height && (
        <>
          <div style={{
            fontSize: 9, fontFamily: "var(--font-mono)",
            letterSpacing: "0.16em", color: "var(--text-dim)",
            textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            Specs <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", padding: "0.6rem 0.75rem",
            fontFamily: "var(--font-mono)", fontSize: 11,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>WALL HEIGHT</span>
              <span style={{ color: "var(--text)" }}>{fp.wall_height} m</span>
            </div>
            {fp.wall_thickness && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>WALL THICKNESS</span>
                <span style={{ color: "var(--text)" }}>{fp.wall_thickness} m</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
