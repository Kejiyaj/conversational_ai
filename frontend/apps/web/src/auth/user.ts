// Demo sign-in against the local stand-in identity provider (spec 008). Any username works. The
// username and access token are kept in this browser; the password is never stored. Replace with
// the real Okta sign-in later.

export type User = { username: string; displayName: string; token: string };

const TOKEN_URL = import.meta.env.VITE_OIDC_TOKEN_URL ?? "http://localhost:8090/default/token";

const KEY = "convai.user";

/** "vinod.patil@example.com" → "Vinod"; "jane doe" → "Jane". */
export function displayNameFor(username: string): string {
  const first = username.trim().split("@")[0].split(/[\s._-]+/).find(Boolean) ?? "";
  return first ? first[0].toUpperCase() + first.slice(1) : "there";
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<User>) : null;
    // An entry without a token (stored before spec 008) counts as signed out.
    return parsed?.username && parsed.token
      ? { username: parsed.username, displayName: displayNameFor(parsed.username), token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

/** Gets a token from the stand-in. Throws, storing nothing, if it refuses or can't be reached. */
export async function signIn(username: string, password: string): Promise<User> {
  const name = username.trim();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      username: name,
      password,
      client_id: "convai-web",
      scope: "openid",
    }),
  });
  if (!res.ok) throw new Error(`Sign-in failed (${res.status})`);
  const { access_token: token } = (await res.json()) as { access_token?: string };
  if (!token) throw new Error("Sign-in failed (no token)");
  localStorage.setItem(KEY, JSON.stringify({ username: name, token }));
  return { username: name, displayName: displayNameFor(name), token };
}

export function signOut(): void {
  localStorage.removeItem(KEY);
}
