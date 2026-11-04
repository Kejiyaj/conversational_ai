// Typed calls to the backend. Each throws an Error on a network failure or a non-2xx response.
// Contract: README.md and specs/001-chat-session-sidebar/contracts/sessions-api.md.

export type ChatResponse = { session_id: string; reply: string; intent: string | null };

export type HistoryMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  intent: string | null;
  latency_ms: number | null;
  source: "agent" | "mock" | null;
  created_at: string;
};

export type HistoryResponse = { session_id: string; messages: HistoryMessage[] };

export type SessionSummary = {
  session_id: string;
  title: string;
  created_at: string;
  last_active_at: string;
};

export type SessionsResponse = { sessions: SessionSummary[] };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export function sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export function getHistory(sessionId: string): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/api/chat/${encodeURIComponent(sessionId)}/history`);
}

export async function listSessions(ids: string[]): Promise<SessionsResponse> {
  if (ids.length === 0) return { sessions: [] };
  const query = ids.map((id) => `ids=${encodeURIComponent(id)}`).join("&");
  return request<SessionsResponse>(`/api/sessions?${query}`);
}
