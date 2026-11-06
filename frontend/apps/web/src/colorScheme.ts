type SchemeQuery = {
  matches: boolean;
  addEventListener: (type: "change", fn: (e: { matches: boolean }) => void) => void;
  removeEventListener: (type: "change", fn: (e: { matches: boolean }) => void) => void;
};

/**
 * Keep the `dark` class on `root` in sync with the system colour scheme (spec 005 UI-007).
 * The dark palette lives in theme/principal.css. Returns a function that stops following.
 */
export function followColorScheme(
  root: HTMLElement = document.documentElement,
  query: SchemeQuery | undefined = window.matchMedia?.("(prefers-color-scheme: dark)"),
): () => void {
  if (!query) return () => {};
  const apply = (e: { matches: boolean }) => root.classList.toggle("dark", e.matches);
  apply(query);
  query.addEventListener("change", apply);
  return () => query.removeEventListener("change", apply);
}
