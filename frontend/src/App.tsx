import { useCallback, useEffect, useRef, useState } from "react";

import { getHistory, listSessions, sendMessage, type SessionSummary } from "./api";
import { getSessionIds, rememberSession } from "./sessionStore";
import Sidebar from "./Sidebar";

type Message = { role: "user" | "assistant"; text: string };
type SidebarError = { message: string; retry: () => void };

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Set<string>>(() => new Set()); // sessions awaiting a reply
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarError, setSidebarError] = useState<SidebarError | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { sessions } = await listSessions(getSessionIds());
      setSessions(sessions);
      setSidebarError(null);
    } catch {
      setSidebarError({ message: "Couldn't load past chats.", retry: () => void loadSessions() });
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Which conversation is on screen, and a counter bumped each time the view changes.
  // Async results (replies, history loads) check these so they never land in the wrong chat.
  const activeRef = useRef(activeSessionId);
  const viewVersion = useRef(0);
  const openRequest = useRef(0);

  const showSession = useCallback((sessionId: string, msgs: Message[]) => {
    activeRef.current = sessionId;
    viewVersion.current += 1;
    setActiveSessionId(sessionId);
    setMessages(msgs);
  }, []);

  const openSession = useCallback(
    async (sessionId: string) => {
      const request = ++openRequest.current;
      try {
        const history = await getHistory(sessionId);
        if (request !== openRequest.current) return; // a newer selection won
        // Only switch once the history is in, so a failure leaves the current chat untouched.
        showSession(
          sessionId,
          history.messages.map((m) => ({ role: m.role, text: m.content })),
        );
        setSidebarError(null);
        setSidebarOpen(false);
      } catch {
        if (request !== openRequest.current) return;
        setSidebarError({
          message: "Couldn't open that chat.",
          retry: () => void openSession(sessionId),
        });
      }
    },
    [showSession],
  );

  function newChat() {
    // A fresh id only; nothing is stored or sent until the first message (spec FR-008).
    openRequest.current += 1; // drop any history load still in flight
    showSession(crypto.randomUUID(), []);
    setSidebarError(null);
    setInput("");
    setSidebarOpen(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const sessionId = activeSessionId;
    const version = viewVersion.current;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setPending((p) => new Set(p).add(sessionId));

    let reply: string;
    let ok = false;
    try {
      reply = (await sendMessage(sessionId, text)).reply;
      ok = true;
    } catch {
      reply = "Something went wrong.";
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(sessionId);
        return next;
      });
    }

    if (ok) {
      rememberSession(sessionId);
      void loadSessions();
    }
    if (viewVersion.current === version) {
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } else if (ok && activeRef.current === sessionId) {
      // The user left and came back while waiting; the server has the full thread now.
      void openSession(sessionId);
    }
  }

  const waiting = pending.has(activeSessionId);

  return (
    <div className={sidebarOpen ? "layout open" : "layout"}>
      <aside className="sidebar">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={(id) => void openSession(id)}
          onNewChat={newChat}
          error={sidebarError?.message ?? null}
          onRetry={() => sidebarError?.retry()}
          loading={sessionsLoading}
        />
      </aside>
      {sidebarOpen && (
        // Narrow screens only (hidden by CSS otherwise): tap outside the sidebar to close it.
        <div className="backdrop" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="chat">
        <header className="chat-header">
          <button
            type="button"
            className="chats-toggle"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            Chats
          </button>
          <h1>Conversational AI</h1>
        </header>
        <div className="messages">
          {messages.map((m, i) => (
            <p key={i} className={`message ${m.role}`}>
              {m.text}
            </p>
          ))}
          {waiting && <p className="pending">…</p>}
        </div>
        <form onSubmit={send} className="composer">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message"
          />
          <button disabled={waiting}>Send</button>
        </form>
      </main>
    </div>
  );
}
