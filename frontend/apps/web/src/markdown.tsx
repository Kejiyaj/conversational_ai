import type { ReactNode } from "react";

import { toBlocks } from "@convai/core";

/**
 * Renders assistant replies, with **bold** support. Everything is rendered as React text nodes,
 * so HTML in a reply is never parsed.
 */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {toBlocks(text).map((b, i) => {
        if (b.kind === "p") {
          return (
            <p key={i}>
              {b.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {inline(line)}
                </span>
              ))}
            </p>
          );
        }
        const List = b.kind;
        return (
          <List key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
