import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Project } from "../lib/api";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [brief, setBrief] = useState("A small 2-bedroom modern house with an open living/kitchen, one bathroom, and a covered front porch.");
  const [title, setTitle] = useState("My first house");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => { api.listProjects().then(setProjects).catch(() => {}); }, []);

  async function create() {
    setBusy(true);
    try {
      const p = await api.createProject(brief, title);
      nav(`/p/${p.id}`);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>🏠 Housify</h1>
      <p style={{ color: "#a0a8b8" }}>AI architect — chat your house into existence.</p>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>New project</h2>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label style={{ display: "block", marginTop: "0.75rem" }}>Brief</label>
        <textarea
          value={brief} onChange={(e) => setBrief(e.target.value)}
          rows={4}
        />
        <div style={{ marginTop: "0.75rem" }}>
          <button disabled={busy || !brief.trim()} onClick={create}>
            {busy ? "Designing…" : "Generate floor plan"}
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: "2rem" }}>All projects</h2>
      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {projects.map((p) => (
          <Link key={p.id} to={`/p/${p.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ fontWeight: 600 }}>{p.title}</div>
            <div style={{ fontSize: "0.85rem", color: "#a0a8b8", marginTop: "0.4rem" }}>{p.brief.slice(0, 110)}…</div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.4rem" }}>{new Date(p.created_at).toLocaleString()}</div>
          </Link>
        ))}
        {projects.length === 0 && <div style={{ color: "#6b7280" }}>No projects yet — create one above.</div>}
      </div>
    </div>
  );
}
