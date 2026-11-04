import { describe, expect, it } from "vitest";

import { splitDisclaimer } from "../messageText";

describe("splitDisclaimer", () => {
  it("pulls a trailing _italic_ paragraph out as the disclaimer, without underscores", () => {
    expect(splitDisclaimer("Your portfolio is worth $70,000.\n\n_Not financial advice._")).toEqual({
      body: "Your portfolio is worth $70,000.",
      disclaimer: "Not financial advice.",
    });
  });

  it("handles a reply that is only the disclaimer", () => {
    expect(splitDisclaimer("_Not financial advice._")).toEqual({
      body: "",
      disclaimer: "Not financial advice.",
    });
  });

  it("leaves text without a trailing italic paragraph alone", () => {
    for (const text of ["(mock) You said: hi", "a_b_c", "_one_ word then more", "x\n\n_open only"]) {
      expect(splitDisclaimer(text)).toEqual({ body: text, disclaimer: null });
    }
  });

  it("keeps earlier paragraphs intact", () => {
    expect(splitDisclaimer("One.\n\nTwo.\n\n_Note._").body).toBe("One.\n\nTwo.");
  });
});
