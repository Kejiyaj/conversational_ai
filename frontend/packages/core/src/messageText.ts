/**
 * The agent ends some replies with a disclaimer paragraph in Markdown italics ("\n\n_..._").
 * Split it off so the UI can show it as a separate note instead of raw underscores.
 */
export function splitDisclaimer(text: string): { body: string; disclaimer: string | null } {
  const match = text.match(/(?:^|\n\n)_([^\n]+)_\s*$/);
  if (!match || match.index === undefined) return { body: text, disclaimer: null };
  return { body: text.slice(0, match.index).trimEnd(), disclaimer: match[1].trim() };
}
