import type { SessionSummary } from "./api";

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
    <nav className="sidebar-nav" aria-label="Past chats">
      <button type="button" className="new-chat" onClick={onNewChat}>
        New chat
      </button>
      {error && (
        <div className="sidebar-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {sessions.length === 0 && !loading && !error && <p className="sidebar-empty">No past chats yet.</p>}
      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.session_id}>
            <button
              type="button"
              className="session-item"
              aria-current={s.session_id === activeSessionId ? "true" : undefined}
              onClick={() => onSelect(s.session_id)}
            >
              <span className="session-title">{s.title}</span>
              <time dateTime={s.last_active_at}>{timeFormat.format(new Date(s.last_active_at))}</time>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
