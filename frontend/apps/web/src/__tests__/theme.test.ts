// Design tokens come from Figma and live in one file: packages/tokens/tokens.json (spec 007 FR-009).
// This checks the generated web theme, and that no other source file hard-codes colors.
import { describe, expect, it } from "vitest";

import themeCss from "@convai/tokens/principal.css?raw";

// Every other source file, as text: this app (without the tests) and the shared packages.
const sources = import.meta.glob<string>(
  [
    "../**/*.{ts,tsx,css}",
    "!./**",
    "../../../../packages/{ui,core}/src/**/*.{ts,tsx}",
    "!../../../../packages/core/src/__tests__/**",
  ],
  { query: "?raw", import: "default", eager: true },
);

function token(name: string): string | undefined {
  return themeCss.match(new RegExp(`${name.replace("*", "\\*")}:\\s*([^;]+);`))?.[1].trim();
}

describe("theme", () => {
  it("defines the Figma brand colors, type and radii in the generated principal.css", () => {
    expect(token("--color-primary")).toBe("#005fb8");
    expect(token("--color-navy")).toBe("#002855");
    expect(token("--color-ink")).toBe("#2f2f2f");
    expect(token("--color-page")).toBe("#f7f7f7");
    expect(token("--color-info-100")).toBe("#e3f5fd");
    expect(token("--font-sans")).toMatch(/^'FS Elliot Pro', 'Source Sans 3'/);
    expect(token("--text-base")).toBe("16px");
    expect(token("--radius-2xl")).toBe("24px");
  });

  it("removes Tailwind's default palette so only Figma colors exist", () => {
    expect(token("--color-*")).toBe("initial");
  });

  it("keeps hex colors out of every other source file", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20); // the glob found the app and package files
    const offenders = Object.entries(sources)
      .filter(([, text]) => /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it("uses no shadcn or Tailwind default color names in components", () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) =>
        /\b(?:bg|text|border)-(?:muted-foreground|foreground|background|destructive|gray-\d|slate-\d|blue-\d)\b/.test(text),
      )
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
