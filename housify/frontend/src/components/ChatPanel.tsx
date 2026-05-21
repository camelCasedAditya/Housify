import { useEffect, useRef, useState } from "react";
import { api, streamChat, ChatTurn, Phase } from "../lib/api";
import { useProject } from "../store/project";

export default function ChatPanel({ phase }: { phase: Phase }) {
  const projectId = useProject((s) => s.projectId);
  const reloadPhase = useProject((s) => s.reloadPhase);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api.chatList(projectId, phase).then(setTurns).catch(() => {});
  }, [projectId, phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, partial]);

  function send() {
    if (!projectId || !input.trim() || streaming) return;
    const msg = input.trim();
    setInput("");
    setTurns((t) => [...t, fakeTurn("user", msg)]);
    setStreaming(true);
    setPartial("");
    streamChat(projectId, msg, {
      onToken: (t) => setPartial((p) => p + t),
      onResult: ({ assistant_text, new_version }) => {
        setTurns((t) => [...t, fakeTurn("assistant", assistant_text || (new_version != null ? `Updated floor plan → v${new_version}` : ""))]);
        if (new_version != null) reloadPhase(phase);
      },
      onError: (m) => setTurns((t) => [...t, fakeTurn("assistant", `⚠ ${m}`)]),
      onDone: () => { setStreaming(false); setPartial(""); },
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr auto", height: "100%", borderLeft: "1px solid #262a34" }}>
      <div ref={scrollRef} style={{ overflowY: "auto", padding: "0.75rem" }}>
        {turns.map((t) => (
          <Bubble key={t.id} role={t.role} text={t.content || (t.resulting_version != null ? `→ v${t.resulting_version}` : "")} />
        ))}
        {streaming && partial && <Bubble role="assistant" text={partial} />}
        {streaming && !partial && <div style={{ color: "#a0a8b8", fontSize: 12 }}>thinking…</div>}
      </div>
      <div style={{ borderTop: "1px solid #262a34", padding: "0.6rem", display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem" }}>
        <textarea
          rows={2} placeholder="Describe the change you want…"
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={streaming || !input.trim()}>Send</button>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", margin: "0.4rem 0" }}>
      <div style={{
        maxWidth: "85%", padding: "0.5rem 0.7rem", borderRadius: 8,
        background: isUser ? "#2b6cb0" : "#23283280",
        border: isUser ? "0" : "1px solid #2d3340",
        whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.4,
      }}>{text}</div>
    </div>
  );
}

let _id = 100000;
function fakeTurn(role: ChatTurn["role"], content: string): ChatTurn {
  return { id: ++_id, phase: "floorplan", role, content, resulting_version: null, created_at: new Date().toISOString() };
}
