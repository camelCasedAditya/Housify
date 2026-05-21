import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { useProject } from "../store/project";
import PhaseFloorplan from "./PhaseFloorplan";

function PhaseStub({ label }: { label: string }) {
  return (
    <div style={{ padding: "2rem" }}>
      <h2>{label}</h2>
      <p style={{ color: "#a0a8b8" }}>Coming next. Phase 1 (Floor Plan) is the working slice in this build.</p>
    </div>
  );
}

export default function ProjectShell() {
  const { id } = useParams();
  const setProjectId = useProject((s) => s.setProjectId);
  const reloadPhase = useProject((s) => s.reloadPhase);

  useEffect(() => {
    if (!id) return;
    setProjectId(id);
    reloadPhase("floorplan");
  }, [id]);

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: "1.5rem",
        padding: "0.6rem 1rem", borderBottom: "1px solid #262a34", background: "#13161d",
      }}>
        <Link to="/" style={{ textDecoration: "none", color: "inherit", fontWeight: 700 }}>← Housify</Link>
        <nav style={{ display: "flex", gap: "0.75rem" }}>
          {[
            ["", "1 · Floor plan"],
            ["scene3d", "2 · 3D"],
            ["furnish", "3 · Furnish"],
          ].map(([to, label]) => (
            <NavLink
              key={label}
              to={to as string}
              end={to === ""}
              style={({ isActive }) => ({
                padding: "0.4rem 0.7rem", borderRadius: 6,
                background: isActive ? "#2b6cb0" : "transparent",
                color: isActive ? "white" : "#cbd2dc", textDecoration: "none",
                fontSize: "0.9rem",
              })}
            >{label}</NavLink>
          ))}
        </nav>
      </header>
      <Routes>
        <Route index element={<PhaseFloorplan />} />
        <Route path="scene3d" element={<PhaseStub label="Phase 2 — 3D rendering" />} />
        <Route path="furnish" element={<PhaseStub label="Phase 3 — Furnish" />} />
      </Routes>
    </div>
  );
}
