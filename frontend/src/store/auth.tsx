"use client";

/**
 * Auth context.
 *
 * The JWT lives in localStorage. That is the pragmatic choice for a SPA-style
 * project (and is what the report documents); a production build would prefer
 * an httpOnly cookie so the token is not reachable from JavaScript.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, setToken } from "@/lib/api";
import type { TokenResponse, User } from "@/lib/types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  signIn: (payload: TokenResponse) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      // Expired or missing token. apiFetch has already cleared it.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback((payload: TokenResponse) => {
    setToken(payload.access_token);
    setUser(payload.user);
    setLoading(false);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refresh }),
    [user, loading, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
