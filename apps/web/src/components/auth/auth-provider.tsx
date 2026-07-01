"use client";

import { usePrivy } from "@privy-io/react-auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@occa-market/shared";
import {
  clearStoredToken,
  fetchMe,
  getStoredToken,
  privyLogin,
  setStoredToken,
} from "@/lib/api";
import { config } from "@/lib/config";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "disabled";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// The branch is fixed per load (config is constant), so hook order is stable.
export function AuthProvider({ children }: { children: ReactNode }) {
  return config.privyEnabled ? (
    <PrivyAuthProvider>{children}</PrivyAuthProvider>
  ) : (
    <DisabledAuthProvider>{children}</DisabledAuthProvider>
  );
}

function PrivyAuthProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Hydrate from a stored session token first, so a refresh stays signed in.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (getStoredToken()) {
        const me = await fetchMe().catch(() => null);
        if (active && me) {
          setUser(me);
          setStatus("authenticated");
          return;
        }
      }
      if (active) setStatus("unauthenticated");
    })();
    return () => {
      active = false;
    };
  }, []);

  // Once Privy authenticates and we have no session yet, exchange for our JWT.
  useEffect(() => {
    if (!ready || !authenticated || user) return;
    let active = true;
    void (async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const { token, user: nextUser } = await privyLogin(accessToken);
      setStoredToken(token);
      if (active) {
        setUser(nextUser);
        setStatus("authenticated");
      }
    })().catch(() => {
      /* leave status as-is; user can retry sign-in */
    });
    return () => {
      active = false;
    };
  }, [ready, authenticated, user, getAccessToken]);

  const signIn = useCallback(() => login(), [login]);
  const signOut = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setStatus("unauthenticated");
    void logout();
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function DisabledAuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = {
    user: null,
    status: "disabled",
    signIn: () =>
      console.warn("Privy not configured — set NEXT_PUBLIC_PRIVY_APP_ID."),
    signOut: () => {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
