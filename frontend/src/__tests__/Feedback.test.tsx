// Spec 004: answer feedback in the chat UI.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { installServer, seed, type Server } from "./helpers";

const KEY = "convai.sessionIds";
let server: Server;

beforeEach(() => {
  localStorage.clear();
  server = installServer();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const feedbackPosts = () => server.calls.filter((c) => c.method === "POST" && c.url.endsWith("/feedback"));
const lastFeedback = () => feedbackPosts().at(-1);
const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

async function renderApp() {
  render(<App />);
  await screen.findByText(/no past chats yet/i);
}

/** Send a message and wait for its reply; returns the reply's message id. */
async function chat(text: string): Promise<number> {
  fireEvent.change(screen.getByPlaceholderText("Type a message"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(`(mock) You said: ${text}`);
  const reply = [...server.sessions.values()].flatMap((s) => s.messages).filter((m) => m.role === "assistant").at(-1)!;
  return reply.id;
}

describe("spec 004 US1: rate an answer", () => {
  it("shows unpressed Helpful / Not helpful under a reply, and none for the user's message", async () => {
    await renderApp();
    await chat("hello");
    expect(screen.getAllByRole("button", { name: "Helpful" })).toHaveLength(1);
    expect(pressed("Helpful")).toBe("false");
    expect(pressed("Not helpful")).toBe("false");
  });

  it("saves Helpful with one tap and shows it selected", async () => {
    await renderApp();
    const id = await chat("hello");
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect(pressed("Helpful")).toBe("true"));
    expect(lastFeedback()).toMatchObject({ url: `/api/messages/${id}/feedback`, body: { rating: "up" } });
    expect(lastFeedback()!.body).toEqual({ rating: "up" });
    expect(pressed("Not helpful")).toBe("false");
  });

  it("saves Not helpful with one tap and shows it selected", async () => {
    await renderApp();
    const id = await chat("hello");
    fireEvent.click(screen.getByRole("button", { name: "Not helpful" }));
    await waitFor(() => expect(pressed("Not helpful")).toBe("true"));
    expect(lastFeedback()).toMatchObject({ url: `/api/messages/${id}/feedback` });
    expect(lastFeedback()!.body).toEqual({ rating: "down" });
  });

  it("shows no rating controls on the 'Something went wrong.' reply", async () => {
    await renderApp();
    const ok = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST" ? new Response("{}", { status: 500 }) : ok(input, init),
      ),
    );
    fireEvent.change(screen.getByPlaceholderText("Type a message"), { target: { value: "fails" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Something went wrong.");
    expect(screen.queryByRole("button", { name: "Helpful" })).toBeNull();
  });

  it("lets a reopened chat's replies be rated, starting unrated", async () => {
    seed(server, "a", [["first topic", "(mock) You said: first topic"]]);
    localStorage.setItem(KEY, JSON.stringify(["a"]));
    render(<App />);
    fireEvent.click(within(await screen.findByRole("navigation")).getByRole("button", { name: /first topic/ }));
    await screen.findByText("(mock) You said: first topic");
    const replyId = server.sessions.get("a")!.messages[1].id;
    expect(pressed("Helpful")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect(pressed("Helpful")).toBe("true"));
    expect(lastFeedback()!.url).toBe(`/api/messages/${replyId}/feedback`);
  });

  it("shows an error with Retry when saving fails, and keeps the last saved state", async () => {
    await renderApp();
    await chat("hello");
    server.failFeedback = true;
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save your feedback");
    expect(pressed("Helpful")).toBe("false");
    expect(pressed("Not helpful")).toBe("false");

    server.failFeedback = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(pressed("Helpful")).toBe("true"));
    expect(screen.queryByText(/couldn't save your feedback/i)).toBeNull();
    expect(lastFeedback()!.body).toEqual({ rating: "up" });
  });

  it("disables that reply's thumbs while a save is in progress", async () => {
    await renderApp();
    await chat("hello");
    let release!: () => void;
    server.holdFeedback = new Promise<void>((r) => (release = r));
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Helpful" }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Not helpful" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Not helpful" })); // ignored while saving
    await act(async () => release());
    await waitFor(() => expect(pressed("Helpful")).toBe("true"));
    expect(feedbackPosts()).toHaveLength(1);
  });

  it("keeps a rating when switching to another chat and back in the same visit", async () => {
    seed(server, "b", [["other topic", "(mock) You said: other topic"]]);
    localStorage.setItem(KEY, JSON.stringify(["b"]));
    render(<App />);
    await screen.findByText("other topic");
    await chat("hello");
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect(pressed("Helpful")).toBe("true"));

    const nav = () => within(screen.getByRole("navigation"));
    fireEvent.click(nav().getByRole("button", { name: /other topic/ }));
    await screen.findByText("(mock) You said: other topic");
    fireEvent.click(nav().getByRole("button", { name: /hello/ }));
    await screen.findByText("(mock) You said: hello");
    expect(pressed("Helpful")).toBe("true");
  });
});
