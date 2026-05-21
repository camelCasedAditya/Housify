const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export type Phase = "floorplan" | "scene3d" | "furnish";

export interface Project {
  id: string;
  title: string;
  brief: string;
  units: string;
  created_at: string;
  updated_at: string;
}

export interface PhaseDoc {
  id: number;
  phase: Phase;
  version: number;
  doc: any;
  parent_version: number | null;
  created_at: string;
}

export interface ChatTurn {
  id: number;
  phase: Phase;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  resulting_version: number | null;
  created_at: string;
}

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
async function jpost<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  listProjects: () => jget<Project[]>("/api/projects/"),
  createProject: (brief: string, title?: string) =>
    jpost<Project>("/api/projects/", { brief, title }),
  getProject: (id: string) => jget<Project>(`/api/projects/${id}/`),
  getPhase: (id: string, phase: Phase) =>
    jget<PhaseDoc>(`/api/projects/${id}/phase/${phase}/`),
  getVersions: (id: string, phase: Phase) =>
    jget<PhaseDoc[]>(`/api/projects/${id}/phase/${phase}/versions/`),
  revert: (id: string, phase: Phase, version: number) =>
    jpost<PhaseDoc>(`/api/projects/${id}/phase/${phase}/revert/${version}/`, {}),
  deleteProject: (id: string) =>
    fetch(`${BASE}/api/projects/${id}/`, { method: "DELETE" }).then((r) => {
      if (!r.ok && r.status !== 204) throw new Error(`${r.status}`);
    }),
  chatList: (id: string, phase: Phase) =>
    jget<ChatTurn[]>(`/api/projects/${id}/chat/${phase}/`),
  chatSend: (id: string, message: string) =>
    jpost<{ assistant_text: string; new_version: number | null; new_doc: any }>(
      `/api/projects/${id}/chat/floorplan/`,
      { message }
    ),
};

export function streamChat(
  projectId: string,
  message: string,
  on: {
    onToken?: (t: string) => void;
    onTool?: (name: string) => void;
    onResult?: (r: { new_version: number | null; new_doc: any; assistant_text: string }) => void;
    onError?: (m: string) => void;
    onDone?: () => void;
  }
) {
  const url = `${BASE}/api/projects/${projectId}/chat/floorplan/stream/`;
  const controller = new AbortController();
  (async () => {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      if (!r.ok || !r.body) {
        on.onError?.(`stream open failed: ${r.status}`);
        on.onDone?.();
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const lines = part.split("\n");
          let evt = "message";
          let data = "";
          for (const ln of lines) {
            if (ln.startsWith("event: ")) evt = ln.slice(7).trim();
            else if (ln.startsWith("data: ")) data += ln.slice(6);
          }
          if (!data) continue;
          let parsed: any;
          try { parsed = JSON.parse(data); } catch { continue; }
          if (evt === "token") on.onToken?.(parsed.text);
          else if (evt === "tool") on.onTool?.(parsed.name);
          else if (evt === "result") on.onResult?.(parsed);
          else if (evt === "error") on.onError?.(parsed.message);
          else if (evt === "done") on.onDone?.();
        }
      }
    } catch (e: any) {
      on.onError?.(e?.message || String(e));
      on.onDone?.();
    }
  })();
  return () => controller.abort();
}
