import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

import type { Feedback, FeedbackRating } from "./api";
import { Button } from "@/components/ui/button";

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

export default function FeedbackBar({ state, onSubmit, onRetry }: Props) {
  const saved = state?.saved ?? null;
  const saving = state?.saving ?? false;

  function rate(rating: FeedbackRating) {
    if (saved?.rating === rating) return; // same thumb again: nothing to change
    // Send the full state: the backend replaces the whole record (research R1).
    // A reason only goes with "down"; a comment is kept either way.
    const next: Feedback = { rating };
    if (rating === "down" && saved?.reason) next.reason = saved.reason;
    if (saved?.comment) next.comment = saved.comment;
    onSubmit(next);
  }

  return (
    <div className="flex flex-col gap-1">
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
      </div>
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
