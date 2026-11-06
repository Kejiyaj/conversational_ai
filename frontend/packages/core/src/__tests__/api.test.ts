import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApi, getHistory, sendMessage } from "../api";

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

describe("bearer token (spec 008 FR-028, FR-030)", () => {
  const ok = () => new Response(JSON.stringify({ session_id: "a", messages: [] }));
  const fetchMock = vi.fn(async (..._args: unknown[]) => ok());

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    configureApi({ baseUrl: "", getToken: () => null, onUnauthorized: () => {} });
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ok());
    vi.unstubAllGlobals();
  });

  const headersOf = (call: number) => (fetchMock.mock.calls[call][1] as RequestInit | undefined)?.headers as
    | Record<string, string>
    | undefined;

  it("sends no Authorization header when baseUrl is the only option, or there is no token", async () => {
    configureApi({ baseUrl: "" });
    await getHistory("a");
    expect(headersOf(0)?.Authorization).toBeUndefined();

    configureApi({ getToken: () => null });
    await getHistory("a");
    expect(headersOf(1)?.Authorization).toBeUndefined();
  });

  it("sends Authorization: Bearer <token> and keeps the call's own headers", async () => {
    configureApi({ getToken: () => "tok-1" });
    await getHistory("a");
    expect(headersOf(0)).toEqual({ Authorization: "Bearer tok-1" });

    await sendMessage("a", "hi");
    expect(headersOf(1)).toEqual({ "Content-Type": "application/json", Authorization: "Bearer tok-1" });
  });

  it("reads the token on every request", async () => {
    let token = "one";
    configureApi({ getToken: () => token });
    await getHistory("a");
    token = "two";
    await getHistory("a");
    expect(headersOf(0)?.Authorization).toBe("Bearer one");
    expect(headersOf(1)?.Authorization).toBe("Bearer two");
  });

  it("calls onUnauthorized once on a 401, then throws the usual error", async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 401 }));
    await expect(getHistory("a")).rejects.toThrow("Request failed (401)");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not call onUnauthorized for other failures", async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 404 }));
    await expect(getHistory("a")).rejects.toThrow("Request failed (404)");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("configureApi updates only the options it is given", async () => {
    configureApi({ baseUrl: "https://api.example.com", getToken: () => "t" });
    configureApi({ onUnauthorized: () => {} });
    await getHistory("a");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/chat/a/history");
    expect(headersOf(0)?.Authorization).toBe("Bearer t");
  });
});
