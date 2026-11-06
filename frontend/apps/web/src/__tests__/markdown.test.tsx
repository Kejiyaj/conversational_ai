import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Markdown } from "../markdown";

afterEach(cleanup);

function html(text: string) {
  return render(<Markdown text={text} />).container;
}

describe("Markdown (assistant replies)", () => {
  it("renders an intro line followed by a bullet list", () => {
    const c = html("You hold:\n- VTI worth $30,000\n- BND worth $18,000");
    expect(c.querySelector("p")!.textContent).toBe("You hold:");
    expect(Array.from(c.querySelectorAll("ul > li")).map((li) => li.textContent)).toEqual([
      "VTI worth $30,000",
      "BND worth $18,000",
    ]);
  });

  it("renders numbered lists and **bold**", () => {
    const c = html("1. **Bonds**: increase\n2. Cash: decrease");
    expect(c.querySelectorAll("ol > li")).toHaveLength(2);
    expect(c.querySelector("strong")!.textContent).toBe("Bonds");
  });

  it("splits paragraphs on blank lines", () => {
    expect(html("One.\n\nTwo.").querySelectorAll("p")).toHaveLength(2);
  });

  it("never interprets HTML", () => {
    const c = html("<img src=x onerror=alert(1)> **<b>hi</b>**");
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("b")).toBeNull();
    expect(c.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
