// Spec 003, User Story 2: Principal theme values (SC-003) live in one file (FR-007, SC-005).
// Values: specs/003-shadcn-ai-elements/contracts/theme-tokens.md
import { describe, expect, it } from "vitest";

import themeCss from "../theme/principal.css?raw";

// Every other source file, as text (excludes the theme folder and the tests).
const sources = import.meta.glob<string>(["../**/*.{ts,tsx,css}", "!../theme/**", "!./**"], {
  query: "?raw",
  import: "default",
  eager: true,
});

function variable(css: string, name: string): string | undefined {
  return css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("spec 003 US2: Principal theme", () => {
  it("defines the Principal values in src/theme/principal.css", () => {
    expect(variable(themeCss, "--primary")).toBe("#005fb8");
    expect(variable(themeCss, "--primary-hover")).toBe("#004c97");
    expect(variable(themeCss, "--foreground")).toBe("#2f2f2f");
    expect(variable(themeCss, "--secondary")).toBe("#e3f5fd");
    expect(variable(themeCss, "--ring")).toBe("#3871ff");
    expect(variable(themeCss, "--radius")).toBe("1.5rem");
  });

  it("keeps brand colors out of every other source file", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5); // the glob found the app files
    const offenders = Object.entries(sources)
      .filter(([, text]) => /#005fb8|#004c97|#002855|#e3f5fd/i.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
