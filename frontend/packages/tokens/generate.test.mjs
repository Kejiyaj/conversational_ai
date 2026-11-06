// Spec 007 FR-009: tokens.json is the only source of brand values (Figma, light only).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { renderNative, renderWeb } from "./generate.mjs";

const tokens = JSON.parse(readFileSync(new URL("./tokens.json", import.meta.url), "utf8"));
const generated = (name) => readFileSync(new URL(`./generated/${name}`, import.meta.url), "utf8");

describe("spec 007: design tokens", () => {
  it("holds the Figma colors, type scale, radii, shadows and gradients", () => {
    expect(tokens.color.primary).toBe("#005fb8");
    expect(tokens.color.navy).toBe("#002855");
    expect(Object.keys(tokens.color).length).toBeGreaterThan(30);
    expect(tokens.text.base).toEqual({ size: "16px", lineHeight: "28px" });
    expect(tokens.radius["2xl"]).toBe("24px");
    expect(tokens.shadow.card).toBeDefined();
    expect(tokens.gradient.ai).toMatch(/^linear-gradient\(/);
    expect(tokens.dark).toBeUndefined(); // light only until the design has a dark palette
  });

  it("writes a web Tailwind theme with only Figma colors, and the gradients as utilities", () => {
    const css = renderWeb(tokens);
    expect(css).toContain("@theme {\n  --color-*: initial;\n");
    expect(css).toContain(`--color-primary: ${tokens.color.primary};`);
    expect(css).toContain(`--text-base: 16px;\n  --text-base--line-height: 28px;`);
    expect(css).toContain(`--radius-2xl: 24px;`);
    expect(css).toContain(`@utility bg-ai {\n  background-image: ${tokens.gradient.ai};\n}`);
    expect(css).toContain(`${tokens.gradient.ai} border-box;`); // border-ai
  });

  it("writes native colors under light and dark variants (the same values), with radii in the theme", () => {
    const css = renderNative(tokens);
    const colors = (variant) => css.split(`@variant ${variant} {`)[1].split("}")[0].trim();
    expect(colors("light")).toContain(`--color-primary: ${tokens.color.primary};`);
    expect(colors("dark")).toBe(colors("light"));
    expect(css).toContain(`@theme {\n  --radius-sm: ${tokens.radius.sm};`);
    expect(css).not.toContain("gradient");
  });

  it("has generated files that match tokens.json (run `npm run tokens` if this fails)", () => {
    expect(generated("principal.css")).toBe(renderWeb(tokens));
    expect(generated("uniwind.css")).toBe(renderNative(tokens));
  });
});
