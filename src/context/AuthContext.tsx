// ============================================================================
// Auth Context — manages user state + token persistence
// ============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { authApi } from "../api";
import { AppState } from "react-native";
import { reportPlayIntegrity } from "../lib/playIntegrity";
import { getToken, clearToken } from "../api/client";
import {
  syncPushRegistration,
  unregisterPush,
} from "../lib/pushNotifications";
import type { User } from "../api/auth";
import { isPremiumStatus } from "../lib/premium";

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
    marketingConsent?: boolean;
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

  // Stan konta może zmienić się POZA apką: koniec subskrypcji w Google Play,
  // zwrot, ręczna zmiana w panelu. Bez tego apka trzymała stary dostęp do
  // restartu — user z wygasłym Pakietem wchodził do zadań i dopiero zapis
  // odpowiedzi wracał z błędem (zgłoszone 17.09.2026).
  const lastSync = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (Date.now() - lastSync.current < 30_000) return;
      lastSync.current = Date.now();
      authApi
        .getMe()
        .then(setUser)
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Cichy sync tokenu push przy każdym zalogowanym stanie — odświeża
  // lastSeenAt na backendzie; o zgodę pyta osobno askForPushPermissionOnce
  // (ekrany wyników), nie tutaj.
  useEffect(() => {
    if (user) syncPushRegistration();
  }, [!!user]);

  // Jedna reguła dla wszystkich statusów (w tym ANNUAL) — lib/premium.ts.
  // ADMIN jak na serwerze (isPremiumActive) — bez tego admin z wygasłą datą
  // widział paywalle, choć serwer go wpuszczał.
  const isPremium =
    user?.role === "ADMIN" ||
    isPremiumStatus(user?.subscriptionStatus, user?.subscriptionEnd);

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
    // Świeże konto — raportujemy werdykt Play Integrity (lib/playIntegrity.ts).
    reportPlayIntegrity();
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    await authApi.loginWithGoogle(credential);
    const me = await authApi.getMe();
    setUser(me);
    // Farma kont z 17.09.2026 rejestrowała się WYŁĄCZNIE przez Google — tu
    // werdykt jest najbardziej potrzebny.
    reportPlayIntegrity();
  }, []);

  const logout = useCallback(async () => {
    // Odepnij token push PRZED wylogowaniem — endpoint wymaga auth
    await unregisterPush();
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
