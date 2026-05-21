import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Project } from "../lib/api";

const PROMPTS = [
  "3-bedroom craftsman bungalow, open kitchen into living room, master suite with walk-in closet, covered front porch",
  "Modern studio apartment, open-plan kitchen and living, one bathroom, storage closet",
  "4-bedroom family home, 2 bathrooms, attached garage, large dining room, backyard deck",
  "Cozy 2-bedroom cabin, living room with fireplace nook, shared bathroom, small front porch",
];

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => { api.listProjects().then(setProjects).catch(() => {}); }, []);

  async function create() {
    if (!brief.trim()) return;
    setBusy(true);
    try {
      const p = await api.createProject(brief, title || "Untitled Project");
      nav(`/p/${p.id}`);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
      setBusy(false);
    }
  }

  async function deleteProject(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteProject(id);
      setProjects((ps) => ps.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* TOP BAR */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.9rem 2.5rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.4rem",
          letterSpacing: "0.2em",
          color: "var(--accent)",
        }}>HOUSIFY</span>
        <span style={{
          fontSize: 10,
          color: "var(--text-dim)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}>
          AI FLOOR PLAN GENERATOR · v1.0
        </span>
      </header>

      {/* HERO — two-column */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0",
        borderBottom: "1px solid var(--border)",
        maxWidth: 1100,
        margin: "0 auto",
        width: "100%",
        padding: "4rem 2.5rem 3rem",
        animation: "fade-up 0.4s ease forwards",
      }}>

        {/* LEFT: Headline */}
        <div style={{ paddingRight: "3rem", borderRight: "1px solid var(--border)" }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(4rem, 9vw, 7rem)",
            lineHeight: 0.95,
            letterSpacing: "0.04em",
            color: "var(--text)",
            marginBottom: "1.5rem",
          }}>
            GENERATE<br />
            YOUR<br />
            <span style={{ color: "var(--accent)" }}>FLOOR<br />PLAN.</span>
          </h1>

          <p style={{
            color: "var(--text-muted)",
            fontSize: 12,
            lineHeight: 1.9,
            maxWidth: 340,
            letterSpacing: "0.04em",
          }}>
            Describe any home in plain language.<br />
            Get an editable floor plan in seconds.<br />
            Chat to refine every room and wall.
          </p>

          <div style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: "2rem",
          }}>
            {[["AI-GENERATED", "from natural language"], ["CHAT EDITING", "refine in real-time"], ["VERSION HISTORY", "revert any change"]].map(([title, sub]) => (
              <div key={title}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.06em" }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Form */}
        <div style={{ paddingLeft: "3rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label>Project Name</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My dream home"
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label>Describe Your Home</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="3-bedroom house with open kitchen, master suite, covered porch…"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) create(); }}
            />
          </div>

          {/* Prompt chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", alignSelf: "center", textTransform: "uppercase" }}>Try</span>
            {PROMPTS.map((p, i) => (
              <button
                key={i}
                className="btn-ghost"
                onClick={() => setBrief(p)}
                style={{ fontSize: 10, padding: "0.25rem 0.55rem", borderRadius: 3, letterSpacing: "0.04em", textTransform: "none" }}
              >
                {p.split(",")[0]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em" }}>⌘ + ENTER</span>
            <button
              disabled={busy || !brief.trim()}
              onClick={create}
              style={{ padding: "0.6rem 1.4rem", fontSize: 12, letterSpacing: "0.12em" }}
            >
              {busy ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{
                    width: 10, height: 10,
                    border: "1.5px solid #04090f",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  GENERATING…
                </span>
              ) : "GENERATE FLOOR PLAN →"}
            </button>
          </div>
        </div>
      </div>

      {/* PROJECTS LIST */}
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        width: "100%",
        padding: "2rem 2.5rem 4rem",
        animation: "fade-up 0.4s 0.1s ease both",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}>
            Projects
          </span>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          <span style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
            {projects.length} total
          </span>
        </div>

        {projects.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 11, letterSpacing: "0.06em", paddingTop: "0.5rem" }}>
            No projects yet — generate your first floor plan above.
          </div>
        ) : (
          <div>
            {projects.map((p, i) => (
              <div key={p.id} style={{ position: "relative" }}>
                <Link
                  to={`/p/${p.id}`}
                  className="project-row"
                  style={{
                    opacity: deletingId === p.id ? 0.4 : 1,
                    transition: "opacity 0.15s",
                    animation: `fade-up 0.3s ${i * 0.04}s ease both`,
                  }}
                >
                  {/* Index */}
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-dim)",
                    width: 24,
                    flexShrink: 0,
                    letterSpacing: "0.06em",
                  }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Title */}
                  <span style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                  }}>
                    {p.title}
                  </span>

                  {/* Brief excerpt */}
                  <span style={{
                    flex: 2,
                    fontSize: 11,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.02em",
                  }}>
                    {p.brief.slice(0, 80)}{p.brief.length > 80 ? "…" : ""}
                  </span>

                  {/* Date */}
                  <span style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    letterSpacing: "0.06em",
                    flexShrink: 0,
                    width: 100,
                    textAlign: "right",
                  }}>
                    {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>

                  {/* Delete */}
                  <button
                    className="btn-delete"
                    onClick={(e) => deleteProject(e, p.id)}
                    disabled={deletingId === p.id}
                    title="Delete project"
                  >
                    {deletingId === p.id ? "…" : "×"}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
