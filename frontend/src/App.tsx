import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpIcon, MenuIcon } from "lucide-react";

import { getHistory, listSessions, sendMessage, type SessionSummary } from "./api";
import { getSessionIds, rememberSession } from "./sessionStore";
import Sidebar from "./Sidebar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message as MessageRow, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

// `failed` marks the "Something went wrong." reply so it gets the error style (view only, never sent).
type Message = { role: "user" | "assistant"; text: string; failed?: boolean };
type SidebarError = { message: string; retry: () => void };

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Set<string>>(() => new Set()); // sessions awaiting a reply
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarError, setSidebarError] = useState<SidebarError | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { sessions } = await listSessions(getSessionIds());
      setSessions(sessions);
      setSidebarError(null);
    } catch {
      setSidebarError({ message: "Couldn't load past chats.", retry: () => void loadSessions() });
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Which conversation is on screen, and a counter bumped each time the view changes.
  // Async results (replies, history loads) check these so they never land in the wrong chat.
  const activeRef = useRef(activeSessionId);
  const viewVersion = useRef(0);
  const openRequest = useRef(0);

  const showSession = useCallback((sessionId: string, msgs: Message[]) => {
    activeRef.current = sessionId;
    viewVersion.current += 1;
    setActiveSessionId(sessionId);
    setMessages(msgs);
  }, []);

  const openSession = useCallback(
    async (sessionId: string) => {
      const request = ++openRequest.current;
      try {
        const history = await getHistory(sessionId);
        if (request !== openRequest.current) return; // a newer selection won
        // Only switch once the history is in, so a failure leaves the current chat untouched.
        showSession(
          sessionId,
          history.messages.map((m) => ({ role: m.role, text: m.content })),
        );
        setSidebarError(null);
        setSidebarOpen(false);
      } catch {
        if (request !== openRequest.current) return;
        setSidebarError({
          message: "Couldn't open that chat.",
          retry: () => void openSession(sessionId),
        });
      }
    },
    [showSession],
  );

  function newChat() {
    // A fresh id only; nothing is stored or sent until the first message (spec FR-008).
    openRequest.current += 1; // drop any history load still in flight
    showSession(crypto.randomUUID(), []);
    setSidebarError(null);
    setInput("");
    setSidebarOpen(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const sessionId = activeSessionId;
    const version = viewVersion.current;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setPending((p) => new Set(p).add(sessionId));

    let reply: string;
    let ok = false;
    try {
      reply = (await sendMessage(sessionId, text)).reply;
      ok = true;
    } catch {
      reply = "Something went wrong.";
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(sessionId);
        return next;
      });
    }

    if (ok) {
      rememberSession(sessionId);
      void loadSessions();
    }
    if (viewVersion.current === version) {
      setMessages((m) => [...m, { role: "assistant", text: reply, failed: !ok }]);
    } else if (ok && activeRef.current === sessionId) {
      // The user left and came back while waiting; the server has the full thread now.
      void openSession(sessionId);
    }
  }

  const waiting = pending.has(activeSessionId);

  // Enter sends, Shift+Enter adds a new line (spec 003 FR-004).
  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!waiting) e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    // `layout`/`open`, `backdrop`, `message` and `pending` are test hooks (spec 003 tasks): keep them.
    <div className={`layout flex h-dvh bg-background text-foreground${sidebarOpen ? " open" : ""}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[260px] shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={(id) => void openSession(id)}
          onNewChat={newChat}
          error={sidebarError?.message ?? null}
          onRetry={() => sidebarError?.retry()}
          loading={sessionsLoading}
        />
      </aside>
      {sidebarOpen && (
        // Narrow screens only (hidden by CSS otherwise): tap outside the sidebar to close it.
        <div
          className="backdrop fixed inset-0 z-20 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            className="md:hidden"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <MenuIcon />
            Chats
          </Button>
          <h1 className="text-lg font-semibold">Conversational AI</h1>
        </header>

        <MessageScrollerProvider autoScroll>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
                {messages.map((m, i) => (
                  <MessageScrollerItem key={`${activeSessionId}-${i}`} scrollAnchor={m.role === "user"}>
                    <MessageRow align={m.role === "user" ? "end" : "start"}>
                      <MessageContent>
                        <Bubble
                          align={m.role === "user" ? "end" : "start"}
                          variant={m.role === "user" ? "default" : m.failed ? "destructive" : "secondary"}
                        >
                          <BubbleContent className="message whitespace-pre-wrap text-base">{m.text}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </MessageRow>
                  </MessageScrollerItem>
                ))}
                {waiting && (
                  <MessageScrollerItem>
                    <p className="pending px-3 text-muted-foreground" role="status">
                      …<span className="sr-only">Waiting for reply</span>
                    </p>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton>
              <ArrowUpIcon className="rotate-180" />
              <span className="sr-only">Scroll to latest</span>
            </MessageScrollerButton>
          </MessageScroller>
        </MessageScrollerProvider>

        <form onSubmit={send} className="mx-auto w-full max-w-3xl px-4 pb-4">
          <InputGroup>
            <InputGroupTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Type a message"
              rows={1}
              className="max-h-40 min-h-0 text-base"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="default" size="icon-sm" aria-label="Send" disabled={waiting}>
                <ArrowUpIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </main>
    </div>
  );
}
