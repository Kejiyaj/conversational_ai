import { vi } from "vitest";

import type { HistoryMessage, SessionSummary } from "../api";

export type Server = {
  sessions: Map<string, { title: string; messages: HistoryMessage[]; lastActive: number }>;
  failHistory: boolean;
  failList: boolean;
  /** When set, POST /api/chat waits for this promise before answering. */
  holdChat: Promise<void> | null;
  calls: { method: string; url: string; body?: unknown }[];
};

let nextId = 1;
let clock = 0;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function message(role: "user" | "assistant", content: string): HistoryMessage {
  return {
    id: nextId++,
    role,
    content,
    intent: null,
    latency_ms: null,
    source: role === "assistant" ? "mock" : null,
    created_at: new Date(Date.UTC(2026, 10, 4, 9, 0, clock++)).toISOString(),
  };
}

/** Seed a stored conversation, as if it had been chatted earlier. */
export function seed(server: Server, id: string, turns: [string, string][]) {
  const messages = turns.flatMap(([u, a]) => [message("user", u), message("assistant", a)]);
  server.sessions.set(id, { title: turns[0][0], messages, lastActive: clock++ });
}

/** A fake backend behind a mocked global fetch, following the README / sessions-api contract. */
export function installServer(): Server {
  const server: Server = {
    sessions: new Map(),
    failHistory: false,
    failList: false,
    holdChat: null,
    calls: [],
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      server.calls.push({ method, url: url.pathname + url.search, body });

      if (method === "GET" && url.pathname === "/api/sessions") {
        if (server.failList) return json({ detail: "boom" }, 500);
        const ids = url.searchParams.getAll("ids");
        const sessions: SessionSummary[] = ids
          .filter((id) => server.sessions.has(id))
          .map((id) => {
            const s = server.sessions.get(id)!;
            const at = new Date(Date.UTC(2026, 10, 4, 9, 0, s.lastActive)).toISOString();
            return { session_id: id, title: s.title, created_at: at, last_active_at: at, _k: s.lastActive };
          })
          .sort((a, b) => b._k - a._k)
          .map(({ _k, ...rest }) => rest);
        return json({ sessions });
      }

      const history = url.pathname.match(/^\/api\/chat\/(.+)\/history$/);
      if (method === "GET" && history) {
        if (server.failHistory) return json({ detail: "boom" }, 500);
        const id = decodeURIComponent(history[1]);
        return json({ session_id: id, messages: server.sessions.get(id)?.messages ?? [] });
      }

      if (method === "POST" && url.pathname === "/api/chat") {
        const { session_id, message: text } = body as { session_id: string; message: string };
        if (server.holdChat) await server.holdChat;
        const reply = `(mock) You said: ${text}`;
        const existing = server.sessions.get(session_id);
        const msgs = [message("user", text), message("assistant", reply)];
        if (existing) {
          existing.messages.push(...msgs);
          existing.lastActive = clock++;
        } else {
          server.sessions.set(session_id, { title: text, messages: msgs, lastActive: clock++ });
        }
        return json({ session_id, reply, intent: null });
      }

      return json({ detail: "not found" }, 404);
    }),
  );

  return server;
}
