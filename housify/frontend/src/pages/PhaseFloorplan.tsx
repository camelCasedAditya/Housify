import { useEffect, useState } from "react";
import { useProject } from "../store/project";
import FloorplanCanvas from "../components/FloorplanCanvas";
import ChatPanel from "../components/ChatPanel";
import VersionPanel from "../components/VersionPanel";
import StatsPanel from "../components/StatsPanel";

type SidebarTab = "chat" | "stats";

export default function PhaseFloorplan() {
  const doc = useProject((s) => s.phaseDoc.floorplan);
  const reloadPhase = useProject((s) => s.reloadPhase);
  const [tab, setTab] = useState<SidebarTab>("chat");

  useEffect(() => { reloadPhase("floorplan"); }, []);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 340px",
      height: "100%",
      overflow: "hidden",
    }}>
      {/* CANVAS */}
      <div style={{
        position: "relative",
        padding: "0.75rem",
        background: "var(--bg)",
        overflow: "hidden",
      }}>
        {doc?.doc ? (
          <FloorplanCanvas doc={doc.doc} version={doc.version} />
        ) : (
          <GeneratingState />
        )}
      </div>

      {/* SIDEBAR */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
      }}>
        {/* TAB BAR */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          {(["chat", "stats"] as SidebarTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                borderRadius: 0,
                color: tab === t ? "var(--accent)" : "var(--text-dim)",
                padding: "0.65rem 0",
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "color 0.15s",
                fontWeight: tab === t ? 600 : 400,
              }}
            >
              {t === "chat" ? "Refine" : "Statistics"}
            </button>
          ))}
        </div>

        {/* PANEL */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {tab === "chat" ? (
            <ChatPanel phase="floorplan" />
          ) : (
            <StatsPanel />
          )}
        </div>

        <VersionPanel phase="floorplan" />
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <div style={{
      height: "100%",
      display: "grid",
      placeItems: "center",
      borderRadius: "var(--radius)",
      animation: "fade-in 0.3s ease",
    }}
    className="blueprint-canvas"
    >
      <div style={{ textAlign: "center" }}>
        <div className="generating-ring" />
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          letterSpacing: "0.12em",
          color: "var(--accent)",
          marginTop: "1.25rem",
        }}>
          DESIGNING YOUR PLAN
        </p>
        <p style={{
          color: "var(--text-dim)",
          fontSize: 10,
          marginTop: "0.5rem",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          AI is reasoning about your space
        </p>
      </div>
    </div>
  );
}
