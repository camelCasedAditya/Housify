import { useEffect, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { useProject } from "../store/project";
import { api, Project } from "../lib/api";
import PhaseFloorplan from "./PhaseFloorplan";

export default function ProjectShell() {
  const { id } = useParams();
  const setProjectId = useProject((s) => s.setProjectId);
  const reloadPhase = useProject((s) => s.reloadPhase);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!id) return;
    setProjectId(id);
    reloadPhase("floorplan");
    api.getProject(id).then(setProject).catch(() => {});
  }, [id]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0 1.25rem",
        height: 52,
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        flexShrink: 0,
      }}>
        <Link
          to="/"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.3rem",
            letterSpacing: "0.2em",
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          ← HOUSIFY
        </Link>

        <div style={{ width: 1, height: 20, background: "var(--border)" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 13,
            color: "var(--text)",
            lineHeight: 1,
            letterSpacing: "0.04em",
          }}>
            {project?.title ?? "…"}
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            Floor Plan
          </span>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <Routes>
          <Route index element={<PhaseFloorplan />} />
        </Routes>
      </div>
    </div>
  );
}
