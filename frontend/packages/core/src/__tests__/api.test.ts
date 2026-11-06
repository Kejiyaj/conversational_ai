import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApi, getHistory } from "../api";

describe("configureApi (spec 007 FR-008)", () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ session_id: "a", messages: [] })));

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    configureApi({ baseUrl: "" });
    fetchMock.mockClear();
    vi.unstubAllGlobals();
  });

  it("uses the relative /api path by default", async () => {
    await getHistory("a");
    expect(fetchMock).toHaveBeenCalledWith("/api/chat/a/history", undefined);
  });

  it("prefixes requests with the configured base location", async () => {
    configureApi({ baseUrl: "https://api.example.com/" });
    await getHistory("a");
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/api/chat/a/history", undefined);
  });
});
