import { useState, type FormEvent } from "react";

import { Button } from "@convai/ui/button";
import { Card } from "@convai/ui/card";
import { PrincipalLogo } from "@convai/ui/logo";
import { StatusTag } from "@convai/ui/status-tag";
import { TextField } from "@convai/ui/text-field";

/** Demo sign-in page in the Principal style. Any username and password are accepted. */
export function LoginPage({
  onSignIn,
  notice,
}: {
  /** Rejects if the sign-in fails. */
  onSignIn: (username: string, password: string) => Promise<void>;
  /** Shown above the form, e.g. when the session ended. */
  notice?: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      username: username.trim() ? undefined : "Enter your username.",
      password: password ? undefined : "Enter your password.",
    };
    setErrors(next);
    if (next.username || next.password) return;
    setPending(true);
    setFailed(false);
    try {
      await onSignIn(username, password);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-full flex-col items-center overflow-hidden bg-page px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-125 left-1/2 h-185.75 w-321.5 -translate-x-1/2 bg-aura opacity-30"
      />
      <main className="relative flex w-full max-w-110 flex-col items-center gap-8 pt-[6vh]">
        <PrincipalLogo />
        <Card variant="tile" className="flex w-full flex-col gap-6 p-8">
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-navy">Sign in to Alfred</h1>
            <p className="text-base text-muted">Your AI guide to your Principal plan.</p>
          </header>
          {notice && (
            <p role="status" className="text-sm text-navy">
              {notice}
            </p>
          )}
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <TextField
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={errors.username}
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            {failed && (
              <p role="alert" className="text-sm text-warning-700">
                Couldn't sign in. Check that the local sign-in service is running, then try again.
              </p>
            )}
            <Button type="submit" variant="primary" className="mt-2 w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="flex items-start gap-2 border-t border-line pt-4 text-sm text-muted">
            <StatusTag tone="neutral" className="shrink-0">
              Demo
            </StatusTag>
            Sign-in uses a local test identity provider. Any username and password works.
          </p>
        </Card>
      </main>
    </div>
  );
}
