import { PlusIcon } from "lucide-react";

import type { SessionSummary } from "./api";
import { Button } from "@/components/ui/button";

type Props = {
  sessions: SessionSummary[];
  activeSessionId: string;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  error: string | null;
  onRetry: () => void;
  loading: boolean;
};

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  error,
  onRetry,
  loading,
}: Props) {
  return (
    <nav className="flex flex-col gap-3" aria-label="Past chats">
      <Button type="button" onClick={onNewChat}>
        <PlusIcon />
        New chat
      </Button>
      {error && (
        <div
          className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
      {sessions.length === 0 && !loading && !error && (
        <p className="px-2 text-sm text-muted-foreground">No past chats yet.</p>
      )}
      {/* `session-title` is a test hook (spec 003 tasks): keep it. */}
      <ul className="flex flex-col gap-1">
        {sessions.map((s) => (
          <li key={s.session_id}>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2 text-left whitespace-normal aria-[current=true]:bg-sidebar-accent aria-[current=true]:text-sidebar-accent-foreground"
              aria-current={s.session_id === activeSessionId ? "true" : undefined}
              onClick={() => onSelect(s.session_id)}
            >
              <span className="session-title w-full truncate font-medium">{s.title}</span>
              <time className="text-xs text-muted-foreground" dateTime={s.last_active_at}>
                {timeFormat.format(new Date(s.last_active_at))}
              </time>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
