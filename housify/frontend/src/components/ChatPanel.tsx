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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api.chatList(projectId, phase).then(setTurns).catch(() => {});
  }, [projectId, phase]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
        setTurns((t) => [
          ...t,
          fakeTurn("assistant", assistant_text || (new_version != null ? `Floor plan updated → v${new_version}` : "")),
        ]);
        if (new_version != null) reloadPhase(phase);
      },
      onError: (m) => setTurns((t) => [...t, fakeTurn("assistant", `⚠ ${m}`)]),
      onDone: () => { setStreaming(false); setPartial(""); inputRef.current?.focus(); },
    });
  }

  const isEmpty = turns.length === 0 && !streaming;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* HEADER */}
      <div style={{
        padding: "0.75rem 1rem 0.6rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--text)",
          letterSpacing: "0.04em",
        }}>
          Refine
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--accent-dim)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          AI Chat
        </span>
      </div>

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {isEmpty && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "0.6rem",
            opacity: 0.5,
          }}>
            <div style={{ fontSize: 24 }}>✦</div>
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-dim)",
              textAlign: "center",
              letterSpacing: "0.06em",
              lineHeight: 1.8,
            }}>
              Describe changes<br />to refine your plan
            </p>
          </div>
        )}

        {turns.map((t) => (
          <Bubble
            key={t.id}
            role={t.role}
            text={t.content || (t.resulting_version != null ? `→ v${t.resulting_version}` : "")}
          />
        ))}

        {streaming && partial && <Bubble role="assistant" text={partial} streaming />}

        {streaming && !partial && (
          <div style={{ display: "flex", gap: 4, padding: "0.5rem 0.25rem" }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>

      {/* INPUT */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: "0.6rem",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "0.4rem",
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          rows={2}
          placeholder="Add a bathroom, widen the hallway…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          style={{ fontSize: 13 }}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          style={{ alignSelf: "stretch", padding: "0 0.9rem", fontSize: 13 }}
        >
          {streaming ? (
            <span style={{
              display: "inline-block",
              width: 12, height: 12,
              border: "2px solid #0a0805",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
          ) : "↑"}
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, text, streaming }: { role: string; text: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      animation: "fade-up 0.2s ease",
    }}>
      <div style={{
        maxWidth: "86%",
        padding: "0.5rem 0.75rem",
        borderRadius: isUser ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
        background: isUser ? "var(--accent)" : "var(--card)",
        border: isUser ? "none" : "1px solid var(--border)",
        color: isUser ? "#0a0805" : "var(--text)",
        whiteSpace: "pre-wrap",
        fontSize: 13,
        lineHeight: 1.5,
        fontWeight: isUser ? 500 : 400,
        opacity: streaming ? 0.85 : 1,
      }}>
        {text}
        {streaming && (
          <span style={{
            display: "inline-block",
            width: 2, height: 13,
            background: "var(--accent)",
            marginLeft: 2,
            verticalAlign: "middle",
            animation: "pulse-glow 0.8s ease infinite",
          }} />
        )}
      </div>
    </div>
  );
}

let _id = 100000;
function fakeTurn(role: ChatTurn["role"], content: string): ChatTurn {
  return { id: ++_id, phase: "floorplan", role, content, resulting_version: null, created_at: new Date().toISOString() };
}
