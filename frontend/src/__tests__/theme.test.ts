// Spec 003, User Story 2: theme values (SC-003) live in one file (FR-007, SC-005).
// Navy palette and dark mode amended by spec 005 (UI-006, UI-007).
// Values: specs/003-shadcn-ai-elements/contracts/theme-tokens.md
import { describe, expect, it } from "vitest";

import themeCss from "../theme/principal.css?raw";

// Every other source file, as text (excludes the theme folder and the tests).
const sources = import.meta.glob<string>(["../**/*.{ts,tsx,css}", "!../theme/**", "!./**"], {
  query: "?raw",
  import: "default",
  eager: true,
});

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
}

function variable(css: string, name: string): string | undefined {
  return css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("spec 003 US2: theme", () => {
  it("defines the navy light values in src/theme/principal.css", () => {
    const light = block(themeCss, ":root");
    expect(variable(light, "--primary")).toBe("#0b3a6e");
    expect(variable(light, "--primary-hover")).toBe("#0e4a8c");
    expect(variable(light, "--foreground")).toBe("#16202c");
    expect(variable(light, "--secondary")).toBe("#e8f0fa");
    expect(variable(light, "--brand-accent")).toBe("#4cc3e8");
    expect(variable(light, "--ring")).toBe("#3871ff");
    expect(variable(light, "--radius")).toBe("1.5rem");
  });

  it("defines a dark palette for every color variable used in light mode", () => {
    const light = block(themeCss, ":root");
    const dark = block(themeCss, ".dark");
    const colorVars = [...light.matchAll(/(--[\w-]+):\s*#/g)].map((m) => m[1]);
    expect(colorVars.length).toBeGreaterThan(20);
    for (const name of colorVars) expect(variable(dark, name), name).toMatch(/^#/);
  });

  it("keeps brand colors out of every other source file", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5); // the glob found the app files
    const offenders = Object.entries(sources)
      .filter(([, text]) => /#0b3a6e|#0e4a8c|#e8f0fa|#4cc3e8|#005fb8|#004c97|#002855|#e3f5fd/i.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
