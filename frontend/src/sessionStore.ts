// IDs of the conversations started in this browser, most recent first.
// The sidebar lists only these (spec FR-002). localStorage can be unavailable
// (private mode, blocked site data, quota), so every access is guarded and an
// in-memory copy keeps the sidebar working for the current tab.

const KEY = "convai.sessionIds";
export const MAX_SESSIONS = 200;

let memory: string[] = [];
let useMemory = false; // set once storage has failed, so we don't read a stale copy

function parse(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function getSessionIds(): string[] {
  if (!useMemory) {
    try {
      return parse(localStorage.getItem(KEY));
    } catch {
      useMemory = true;
    }
  }
  return [...memory];
}

export function rememberSession(id: string): void {
  const next = [id, ...getSessionIds().filter((x) => x !== id)].slice(0, MAX_SESSIONS);
  memory = next;
  if (useMemory) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    useMemory = true;
  }
}
