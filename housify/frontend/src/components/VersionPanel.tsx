import { useEffect, useState } from "react";
import { api, PhaseDoc, Phase } from "../lib/api";
import { useProject } from "../store/project";

export default function VersionPanel({ phase }: { phase: Phase }) {
  const projectId = useProject((s) => s.projectId);
  const current = useProject((s) => s.phaseDoc[phase]);
  const reloadPhase = useProject((s) => s.reloadPhase);
  const [versions, setVersions] = useState<PhaseDoc[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!projectId || !open) return;
    api.getVersions(projectId, phase).then(setVersions).catch(() => {});
  }, [projectId, phase, open, current?.version]);

  async function revert(v: number) {
    if (!projectId) return;
    await api.revert(projectId, phase, v);
    await reloadPhase(phase);
  }

  return (
    <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid #262a34" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: "1px solid #2d3340", color: "#cbd2dc" }}>
        {open ? "Hide" : "Show"} versions {current ? `(current v${current.version})` : ""}
      </button>
      {open && (
        <div style={{ marginTop: "0.5rem", maxHeight: 200, overflowY: "auto" }}>
          {versions.map((v) => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0.2rem", fontSize: 12, borderBottom: "1px solid #1f242d" }}>
              <span>v{v.version} · {new Date(v.created_at).toLocaleTimeString()}</span>
              {v.version !== current?.version && (
                <button style={{ padding: "0.15rem 0.4rem", fontSize: 11 }} onClick={() => revert(v.version)}>Revert</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
