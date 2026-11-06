// Spec 005 UI on top of spec 003: branding, welcome + suggestions, Markdown replies, disclaimer note.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { installServer, seed, type Server } from "./helpers";

const KEY = "convai.sessionIds";
let server: Server;

const shownMessages = () =>
  Array.from(document.querySelectorAll(".message")).map((el) => el.textContent ?? "");

async function openSeeded(reply: string) {
  seed(server, "s", [["question", reply]]);
  localStorage.setItem(KEY, JSON.stringify(["s"]));
  render(<App />);
  const nav = await screen.findByRole("navigation");
  fireEvent.click(await within(nav).findByRole("button", { name: /question/ }));
  await waitFor(() => expect(shownMessages()).toHaveLength(2));
}

beforeEach(() => {
  localStorage.clear();
  server = installServer();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("branding", () => {
  it("shows the PFG mark and title", () => {
    render(<App />);
    expect(screen.getAllByRole("img", { name: "PFG" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("PFG Wealth Assistant");
  });

  it("puts the header in a full-width top bar above both the sidebar and the chat", () => {
    render(<App />);
    const banner = screen.getByRole("banner"); // a <header> outside <main>
    expect(within(banner).getByRole("heading", { level: 1 })).toBeTruthy();
    expect(within(banner).getByRole("button", { name: /chats/i })).toBeTruthy();
    expect(banner.compareDocumentPosition(screen.getByRole("navigation")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("welcome screen", () => {
  it("offers suggested questions on an empty chat and sends one when clicked", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "What is my portfolio worth?" }));
    await waitFor(() =>
      expect(shownMessages()).toEqual([
        "What is my portfolio worth?",
        "(mock) You said: What is my portfolio worth?",
      ]),
    );
    expect(screen.queryByRole("button", { name: "What is my portfolio worth?" })).toBeNull();
  });
});

describe("assistant replies", () => {
  it("render Markdown lists and bold instead of raw symbols", async () => {
    await openSeeded("You hold:\n- **VTI** $30,000\n- BND $18,000");
    const reply = document.querySelectorAll(".message")[1];
    expect(Array.from(reply.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
      "VTI $30,000",
      "BND $18,000",
    ]);
    expect(reply.querySelector("strong")!.textContent).toBe("VTI");
  });

  it("show a trailing _italic_ disclaimer as a separate note, outside the bubble", async () => {
    await openSeeded("Your portfolio is worth $70,000.\n\n_Demo data, not financial advice._");
    expect(shownMessages()[1]).toBe("Your portfolio is worth $70,000.");
    const note = document.querySelector(".disclaimer")!;
    expect(note.textContent).toBe("Demo data, not financial advice.");
    expect(document.body.textContent).not.toContain("_Demo");
  });

  it("keep user messages as plain text", async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("Type a message"), { target: { value: "- not a list" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(shownMessages()[0]).toBe("- not a list"));
    expect(document.querySelectorAll(".message")[0].querySelector("li")).toBeNull();
  });
});
