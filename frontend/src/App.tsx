import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpIcon, InfoIcon, MenuIcon } from "lucide-react";

import { getHistory, listSessions, sendMessage, submitFeedback, type Feedback, type SessionSummary } from "./api";
import { getSessionIds, rememberSession } from "./sessionStore";
import FeedbackBar, { type FeedbackState } from "./FeedbackBar";
import { AssistantAvatar, Logo } from "./Logo";
import { Markdown } from "./markdown";
import { splitDisclaimer } from "./messageText";
import Sidebar from "./Sidebar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message as MessageRow, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

// `failed` marks the "Something went wrong." reply so it gets the error style (view only, never sent).
// `id` is the backend message id; replies with one can be rated (spec 004).
type Message = { id?: number; role: "user" | "assistant"; text: string; failed?: boolean };
type SidebarError = { message: string; retry: () => void };

// One click sends these from the welcome screen (spec 005).
const SUGGESTIONS = [
  "What is my portfolio worth?",
  "How does my allocation compare to my target?",
  "Do I need to rebalance?",
  "Project $500 a month at 6% for 20 years",
];

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Set<string>>(() => new Set()); // sessions awaiting a reply
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarError, setSidebarError] = useState<SidebarError | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Feedback per assistant message id, kept for this visit across chat switches (spec 004 FR-011).
  const [feedback, setFeedback] = useState<Map<number, FeedbackState>>(() => new Map());
  const savingFeedback = useRef<Set<number>>(new Set()); // one save per reply at a time (FR-010)

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
          history.messages.map((m) => ({ id: m.id, role: m.role, text: m.content })),
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

  function send(e: React.FormEvent) {
    e.preventDefault();
    void sendText(input);
  }

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || pending.has(activeSessionId)) return;
    const sessionId = activeSessionId;
    const version = viewVersion.current;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setPending((p) => new Set(p).add(sessionId));

    let reply: string;
    let replyId: number | undefined;
    let ok = false;
    try {
      const res = await sendMessage(sessionId, text);
      reply = res.reply;
      replyId = typeof res.message_id === "number" ? res.message_id : undefined;
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
      setMessages((m) => [...m, { id: replyId, role: "assistant", text: reply, failed: !ok }]);
    } else if (ok && activeRef.current === sessionId) {
      // The user left and came back while waiting; the server has the full thread now.
      void openSession(sessionId);
    }
  }

  const waiting = pending.has(activeSessionId);

  function updateFeedback(messageId: number, change: Partial<FeedbackState>) {
    setFeedback((all) => {
      const next = new Map(all);
      const current = next.get(messageId) ?? { saved: null, saving: false, error: null };
      next.set(messageId, { ...current, ...change });
      return next;
    });
  }

  // The screen shows only what the backend confirmed (SC-003); a failure keeps the last saved state.
  async function saveFeedback(messageId: number, value: Feedback) {
    if (savingFeedback.current.has(messageId)) return;
    savingFeedback.current.add(messageId);
    updateFeedback(messageId, { saving: true });
    try {
      await submitFeedback(messageId, value);
      updateFeedback(messageId, { saved: value, saving: false, error: null });
    } catch {
      updateFeedback(messageId, { saving: false, error: { attempted: value } });
    } finally {
      savingFeedback.current.delete(messageId);
    }
  }

  // Enter sends, Shift+Enter adds a new line (spec 003 FR-004).
  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!waiting) e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    // `layout`/`open`, `backdrop`, `message` and `pending` are test hooks (spec 003 tasks): keep them.
    <div className={`layout flex h-dvh flex-col bg-background text-foreground${sidebarOpen ? " open" : ""}`}>
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2.5">
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
        <Logo />
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-lg font-semibold">PFG Wealth Assistant</h1>
          <span className="text-xs text-muted-foreground">AI assistant · Demo data</span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[260px] shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground transition-transform md:static md:translate-x-0 ${
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
            className="backdrop fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <MessageScrollerProvider autoScroll>
            <MessageScroller className="flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
                  {messages.length === 0 && !waiting && (
                    <section className="flex flex-col items-center px-2 pt-[8vh] pb-4 text-center">
                      <Logo size={56} />
                      <h2 className="mt-4 mb-1.5 text-2xl font-semibold">How can I help with your portfolio today?</h2>
                      <p className="mb-6 max-w-md text-muted-foreground">
                        Ask about your holdings, allocation, rebalancing or savings projections. Answers use demo
                        data and are for information only.
                      </p>
                      <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {SUGGESTIONS.map((s) => (
                          <Button
                            key={s}
                            type="button"
                            variant="outline"
                            className="h-auto justify-start rounded-xl px-4 py-3 text-left whitespace-normal"
                            onClick={() => void sendText(s)}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </section>
                  )}
                  {messages.map((m, i) => (
                    <MessageScrollerItem key={`${activeSessionId}-${i}`} scrollAnchor={m.role === "user"}>
                      <MessageRow align={m.role === "user" ? "end" : "start"}>
                        {m.role === "assistant" && <AssistantAvatar />}
                        <MessageContent>
                          {m.role === "user" ? (
                            <Bubble align="end" variant="default">
                              <BubbleContent className="message whitespace-pre-wrap text-base">{m.text}</BubbleContent>
                            </Bubble>
                          ) : (
                            <AssistantReply text={m.text} failed={m.failed} />
                          )}
                          {m.role === "assistant" && m.id !== undefined && (
                            <MessageFooter>
                              <FeedbackBar
                                state={feedback.get(m.id)}
                                onSubmit={(value) => void saveFeedback(m.id!, value)}
                                onRetry={() => {
                                  const attempted = feedback.get(m.id!)?.error?.attempted;
                                  if (attempted) void saveFeedback(m.id!, attempted);
                                }}
                              />
                            </MessageFooter>
                          )}
                        </MessageContent>
                      </MessageRow>
                    </MessageScrollerItem>
                  ))}
                  {waiting && (
                    <MessageScrollerItem>
                      <MessageRow align="start">
                        <AssistantAvatar />
                        <p className="pending flex items-center gap-1.5 px-1 py-3" role="status">
                          {["[animation-delay:-0.3s]", "[animation-delay:-0.15s]", ""].map((delay) => (
                            <span
                              key={delay}
                              className={`size-2 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none ${delay}`}
                            />
                          ))}
                          <span className="sr-only">Waiting for reply</span>
                        </p>
                      </MessageRow>
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
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Enter to send · Shift+Enter for a new line. AI answers can be wrong; check important figures.
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}

// Assistant reply: Markdown in the bubble, and a trailing _italic_ disclaimer as a muted note below it.
function AssistantReply({ text, failed }: { text: string; failed?: boolean }) {
  const { body, disclaimer } = splitDisclaimer(text);
  return (
    <>
      {body && (
        <Bubble align="start" variant={failed ? "destructive" : "secondary"}>
          <BubbleContent className="message text-base [&_li+li]:mt-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
            <Markdown text={body} />
          </BubbleContent>
        </Bubble>
      )}
      {disclaimer && (
        <p className="disclaimer flex max-w-[80%] items-start gap-1.5 px-3 text-xs leading-snug text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{disclaimer}</span>
        </p>
      )}
    </>
  );
}
