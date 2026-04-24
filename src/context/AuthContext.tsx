// ============================================================================
// Auth Context — manages user state + token persistence
// ============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authApi } from "../api";
import { getToken, clearToken } from "../api/client";
import type { User } from "../api/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isPremium: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ requiresVerification?: boolean; email?: string }>;
  register: (data: {
    email: string;
    password: string;
    passwordConfirm: string;
    name?: string;
    acceptTerms: boolean;
  }) => Promise<{ requiresVerification: boolean; email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Bootstrap: check stored token ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await authApi.getMe();
          setUser(me);
        }
      } catch {
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const isPremium =
    user?.subscriptionStatus === "ACTIVE" ||
    (user?.subscriptionStatus === "ONE_TIME" &&
      !!user?.subscriptionEnd &&
      new Date(user.subscriptionEnd) > new Date());

  // ── Actions ─────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      const me = await authApi.getMe();
      setUser(me);
      return {};
    } catch (err: any) {
      if (err.code === "EMAIL_NOT_VERIFIED") {
        return { requiresVerification: true, email: err.data?.email || email };
      }
      throw err;
    }
  }, []);

  const register = useCallback(
    async (data: Parameters<typeof authApi.register>[0]) => {
      return authApi.register(data);
    },
    [],
  );

  const verifyEmail = useCallback(async (email: string, code: string) => {
    await authApi.verifyEmail(email, code);
    const me = await authApi.getMe();
    setUser(me);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    await authApi.loginWithGoogle(credential);
    const me = await authApi.getMe();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      setUser(null);
      await clearToken();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggedIn: !!user,
        isPremium,
        login,
        register,
        verifyEmail,
        loginWithGoogle,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
