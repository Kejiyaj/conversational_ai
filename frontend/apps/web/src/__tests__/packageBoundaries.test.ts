// Spec 007 FR-011: shared packages never import from an app.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>(["../../../../packages/*/src/**/*.{ts,tsx}", "../../../../packages/tokens/*.mjs"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("spec 007: package boundaries", () => {
  it("finds no shared package file that imports from an app", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10); // the glob found the package files
    const offenders = Object.entries(sources)
      .filter(([, text]) => /from\s+["'](?:[^"']*\/apps\/|@convai\/(?:web|mobile))/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
