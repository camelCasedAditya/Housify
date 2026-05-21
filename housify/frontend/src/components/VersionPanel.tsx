import { useEffect, useState } from "react";
import { api, PhaseDoc, Phase } from "../lib/api";
import { useProject } from "../store/project";

export default function VersionPanel({ phase }: { phase: Phase }) {
  const projectId = useProject((s) => s.projectId);
  const current = useProject((s) => s.phaseDoc[phase]);
  const reloadPhase = useProject((s) => s.reloadPhase);
  const [versions, setVersions] = useState<PhaseDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId || !open) return;
    api.getVersions(projectId, phase).then(setVersions).catch(() => {});
  }, [projectId, phase, open, current?.version]);

  async function revert(v: number) {
    if (!projectId) return;
    setReverting(v);
    try {
      await api.revert(projectId, phase, v);
      await reloadPhase(phase);
    } finally {
      setReverting(null);
    }
  }

  return (
    <div style={{
      borderTop: "1px solid var(--border)",
      padding: "0.6rem 0.75rem",
      background: "var(--surface)",
      flexShrink: 0,
    }}>
      <button
        className="btn-ghost"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          padding: "0.35rem 0.6rem",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
          {open ? "▲" : "▼"} VERSION HISTORY
        </span>
        {current && (
          <span style={{
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-dim)",
            color: "var(--accent)",
            padding: "1px 6px",
            borderRadius: 3,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
          }}>
            v{current.version}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          marginTop: "0.5rem",
          maxHeight: 160,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          animation: "fade-up 0.2s ease",
        }}>
          {versions.length === 0 && (
            <div style={{ color: "var(--text-dim)", fontSize: 11, padding: "0.25rem", fontFamily: "var(--font-mono)" }}>
              No versions yet
            </div>
          )}
          {versions.map((v) => {
            const isCurrent = v.version === current?.version;
            return (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background: isCurrent ? "var(--accent-bg)" : "transparent",
                  border: isCurrent ? "1px solid var(--accent-dim)" : "1px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: isCurrent ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: isCurrent ? 500 : 400,
                  }}>
                    v{v.version}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                    {new Date(v.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 9,
                      color: "var(--accent)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.06em",
                    }}>
                      current
                    </span>
                  )}
                </div>
                {!isCurrent && (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "0.2rem 0.5rem", borderRadius: 3 }}
                    onClick={() => revert(v.version)}
                    disabled={reverting === v.version}
                  >
                    {reverting === v.version ? "…" : "Revert"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
