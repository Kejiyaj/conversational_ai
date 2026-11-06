import { useState } from "react";

import { configureApi } from "@convai/core";

import { LoginPage } from "@/auth/LoginPage";
import { getUser, signIn, signOut, type User } from "@/auth/user";
import { ChatApp } from "@/chat/ChatApp";

const SESSION_ENDED = "Your session has ended. Sign in again.";

/** Shows the (demo) sign-in page until someone signs in, then the Alfred chat. */
export default function App() {
  const [user, setUser] = useState<User | null>(getUser);
  const [notice, setNotice] = useState<string | undefined>();

  // Every API call carries the token; a 401 means it is no longer good, so go back to sign-in.
  // Set during render so it is in place before the chat makes its first request.
  configureApi({
    getToken: () => getUser()?.token ?? null,
    onUnauthorized: () => {
      signOut();
      setUser(null);
      setNotice(SESSION_ENDED);
    },
  });

  if (!user) {
    return (
      <LoginPage
        notice={notice}
        onSignIn={async (username, password) => {
          setUser(await signIn(username, password));
          setNotice(undefined);
        }}
      />
    );
  }
  return (
    <ChatApp
      user={user}
      onSignOut={() => {
        signOut();
        setUser(null);
        setNotice(undefined);
      }}
    />
  );
}
