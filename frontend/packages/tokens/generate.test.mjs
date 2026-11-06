// Spec 007 FR-009: tokens.json is the only source of brand values.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { renderNative, renderWeb } from "./generate.mjs";

const tokens = JSON.parse(readFileSync(new URL("./tokens.json", import.meta.url), "utf8"));
const generated = (name) => readFileSync(new URL(`./generated/${name}`, import.meta.url), "utf8");

describe("spec 007: design tokens", () => {
  it("defines every light colour in the dark palette", () => {
    const colours = Object.keys(tokens.light).filter((name) => name !== "radius");
    expect(colours.length).toBeGreaterThan(20);
    for (const name of colours) expect(tokens.dark[name], name).toBeDefined();
  });

  it("writes web variables under :root and .dark", () => {
    const css = renderWeb(tokens);
    expect(css).toContain(`:root {\n  color-scheme: light;\n  --background: ${tokens.light.background};`);
    expect(css).toContain(`.dark {\n  color-scheme: dark;\n  --background: ${tokens.dark.background};`);
    expect(css).toContain(`--radius: ${tokens.light.radius};`);
  });

  it("writes native colours under light and dark variants, with the radius in the theme", () => {
    const css = renderNative(tokens);
    expect(css).toContain(`@variant light {\n      --color-background: ${tokens.light.background};`);
    expect(css).toContain(`@variant dark {\n      --color-background: ${tokens.dark.background};`);
    expect(css).toContain(`--radius-lg: ${tokens.light.radius};`);
    expect(css).not.toContain("--color-radius");
  });

  it("has generated files that match tokens.json (run `npm run tokens` if this fails)", () => {
    expect(generated("principal.css")).toBe(renderWeb(tokens));
    expect(generated("uniwind.css")).toBe(renderNative(tokens));
  });
});
