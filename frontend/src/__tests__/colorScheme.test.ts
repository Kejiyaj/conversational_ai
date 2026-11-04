import { describe, expect, it } from "vitest";

import { followColorScheme } from "../colorScheme";

function fakeQuery(matches: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  return {
    matches,
    addEventListener: (_: "change", fn: (e: { matches: boolean }) => void) => listeners.add(fn),
    removeEventListener: (_: "change", fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
    fire(next: boolean) {
      this.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
    listeners,
  };
}

describe("followColorScheme", () => {
  it("adds the dark class when the system prefers dark and follows changes", () => {
    const root = document.createElement("html");
    const query = fakeQuery(true);
    const stop = followColorScheme(root, query);
    expect(root.classList.contains("dark")).toBe(true);
    query.fire(false);
    expect(root.classList.contains("dark")).toBe(false);
    stop();
    expect(query.listeners.size).toBe(0);
  });

  it("stays light when no media query is available", () => {
    const root = document.createElement("html");
    followColorScheme(root, undefined)();
    expect(root.classList.contains("dark")).toBe(false);
  });
});
