import { useEffect, useState } from "react";
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

import type { Feedback, FeedbackRating, FeedbackReason } from "./api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Per-reply feedback state for this visit (spec 004 data-model.md).
export type FeedbackState = {
  saved: Feedback | null; // last state the backend confirmed; the controls render from this
  saving: boolean;
  error: { attempted: Feedback } | null;
};

type Props = {
  state: FeedbackState | undefined;
  onSubmit: (feedback: Feedback) => void;
  onRetry: () => void;
};

const REASONS: { value: FeedbackReason; label: string }[] = [
  { value: "incorrect", label: "Incorrect" },
  { value: "unclear", label: "Unclear" },
  { value: "wanted_a_person", label: "I wanted a person" },
  { value: "other", label: "Other" },
];
const MAX_COMMENT = 1000;

export default function FeedbackBar({ state, onSubmit, onRetry }: Props) {
  const saved = state?.saved ?? null;
  const saving = state?.saving ?? false;

  // The follow-up (reason + comment) is screen-only state; it opens for the rating it belongs to
  // and shows once that rating is saved.
  const [openFor, setOpenFor] = useState<FeedbackRating | null>(null);
  const [reason, setReason] = useState<FeedbackReason | "">("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState(false);

  // After "Send feedback": close and thank on success; stay open (with the error) on failure.
  useEffect(() => {
    if (!sending || saving) return;
    setSending(false);
    if (!state?.error) {
      setOpenFor(null);
      setThanks(true);
    }
  }, [sending, saving, state?.error]);

  function open(rating: FeedbackRating) {
    setReason(rating === "down" ? (saved?.reason ?? "") : "");
    setComment(saved?.comment ?? "");
    setThanks(false);
    setOpenFor(rating);
  }

  // Every request carries the full state: the backend replaces the whole record (research R1).
  function build(rating: FeedbackRating, r: FeedbackReason | "" | undefined, c: string | undefined): Feedback {
    const next: Feedback = { rating };
    if (rating === "down" && r) next.reason = r;
    if (c && c.trim()) next.comment = c;
    return next;
  }

  function rate(rating: FeedbackRating) {
    if (saved?.rating === rating) return; // same thumb again: nothing to change
    onSubmit(build(rating, saved?.reason, saved?.comment));
    if (rating === "down") open("down");
    else setOpenFor(null);
  }

  function send() {
    if (!openFor) return;
    setSending(true);
    onSubmit(build(openFor, reason, comment));
  }

  const panelOpen = openFor !== null && saved?.rating === openFor;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Helpful"
          aria-pressed={saved?.rating === "up"}
          disabled={saving}
          className="aria-pressed:text-primary"
          onClick={() => rate("up")}
        >
          <ThumbsUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Not helpful"
          aria-pressed={saved?.rating === "down"}
          disabled={saving}
          className="aria-pressed:text-primary"
          onClick={() => rate("down")}
        >
          <ThumbsDownIcon />
        </Button>
        {saved?.rating === "up" && !panelOpen && (
          <Button type="button" variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => open("up")}>
            Add a comment
          </Button>
        )}
        {thanks && !panelOpen && <span className="px-1 text-xs text-muted-foreground">Thanks for your feedback</span>}
      </div>

      {panelOpen && (
        <div className="flex max-w-md flex-col gap-2 rounded-lg border border-border bg-card p-3">
          {openFor === "down" && (
            <>
              <p className="text-sm font-medium">What went wrong? (optional)</p>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                aria-label="Reason"
                className="flex-wrap"
                value={reason}
                onValueChange={(v) => setReason(v as FeedbackReason | "")}
              >
                {REASONS.map((r) => (
                  <ToggleGroupItem key={r.value} value={r.value} className="rounded-full">
                    {r.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </>
          )}
          <Textarea
            aria-label="Comment"
            placeholder="Add a comment (optional)"
            maxLength={MAX_COMMENT}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-16 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{MAX_COMMENT - comment.length} characters left</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenFor(null)}>
                Close
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={send}>
                Send feedback
              </Button>
            </div>
          </div>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
          Couldn't save your feedback.
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>
            Retry
          </Button>
        </p>
      )}
    </div>
  );
}
