/**
 * Minimal Markdown parsing for assistant replies: paragraphs, line breaks, and bullet and numbered
 * lists. Rendering is up to each app.
 */
export type MarkdownBlock =
  | { kind: "p"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function toBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  for (const line of text.split("\n")) {
    const last = blocks[blocks.length - 1];
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] }); // blank line ends the current block
    } else if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      if (last?.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (last?.kind === "p" && last.lines.length > 0) {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => (b.kind === "p" ? b.lines.length > 0 : true));
}
