import { ChartLineIcon } from "lucide-react";

import { MessageAvatar } from "@/components/ui/message";

/**
 * PFG wordmark tile, drawn from theme variables (no brand values here; they live in
 * theme/principal.css). Placeholder until an approved brand asset is provided.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg role="img" aria-label="PFG" viewBox="0 0 48 48" width={size} height={size} className="shrink-0">
      <rect width="48" height="48" rx="11" className="fill-primary" />
      <path d="M11 37h26" strokeWidth="3" strokeLinecap="round" className="stroke-brand-accent" />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fontSize="17"
        fontWeight="800"
        letterSpacing="0.5"
        className="fill-primary-foreground font-sans"
      >
        PFG
      </text>
    </svg>
  );
}

/** Decorative assistant avatar next to each reply (hidden from screen readers). */
export function AssistantAvatar() {
  return (
    <MessageAvatar
      aria-hidden="true"
      className="size-8 self-start! translate-y-0! bg-primary text-brand-accent"
    >
      <ChartLineIcon className="size-4" />
    </MessageAvatar>
  );
}
