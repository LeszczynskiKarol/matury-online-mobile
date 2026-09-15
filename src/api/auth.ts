// ============================================================================
// Auth API — /api/auth/*
// ============================================================================

import { api, setToken, clearToken } from "./client";
import type { SubscriptionStatus } from "../lib/premium";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "STUDENT" | "ADMIN";
  subscriptionStatus: SubscriptionStatus;
  subscriptionEnd: string | null;
  totalXp: number;
  globalLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: string | null;
  // Zgoda na maile marketingowe (art. 10 UŚUDE) — dobrowolna, odwoływalna
  // w profilu. false także dla kont sprzed jej wprowadzenia (2.09.2026).
  marketingConsent?: boolean;
  selectedSubjects?: {
    subject: {
      id: string;
      slug: string;
      name: string;
      icon: string | null;
      color: string | null;
    };
  }[];
  subjectProgress?: {
    subjectId: string;
    xp: number;
    level: number;
    questionsAnswered: number;
    correctAnswers: number;
    adaptiveDifficulty: number;
  }[];
}

interface AuthResponse {
  user: { id: string; email: string; name: string | null; role: string };
  token: string;
}

interface RegisterResponse {
  requiresVerification: boolean;
  email: string;
}

// ── Register ──────────────────────────────────────────────────────────────
export async function register(data: {
  email: string;
  password: string;
  passwordConfirm: string;
  name?: string;
  acceptTerms: boolean;
  marketingConsent?: boolean;
}): Promise<RegisterResponse> {
  return api<RegisterResponse>("/auth/register", {
    method: "POST",
    body: data,
    auth: false,
  });
}

// ── Zgoda marketingowa ────────────────────────────────────────────────────
export async function setMarketingConsent(
  consent: boolean,
): Promise<{ marketingConsent: boolean }> {
  return api<{ marketingConsent: boolean }>("/auth/marketing-consent", {
    method: "PATCH",
    body: { consent },
  });
}

// ── Verify email ──────────────────────────────────────────────────────────
export async function verifyEmail(
  email: string,
  code: string,
): Promise<AuthResponse> {
  const res = await api<AuthResponse>("/auth/verify", {
    method: "POST",
    body: { email, code },
    auth: false,
  });
  await setToken(res.token);
  return res;
}

// ── Resend code ───────────────────────────────────────────────────────────
export async function resendCode(email: string): Promise<{ sent: boolean }> {
  return api("/auth/resend-code", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

// ── Stan doręczenia maila z kodem ─────────────────────────────────────────
// Backend zna go ze zdarzeń SES (pełna skrzynka, nieistniejący adres).
export type VerificationDeliveryState =
  | "unknown"
  | "pending"
  | "delivered"
  | "mailbox_full"
  | "mailbox_full_before"
  | "delayed"
  | "undeliverable"
  | "failed";

export async function verificationStatus(
  email: string,
): Promise<{ state: VerificationDeliveryState }> {
  return api("/auth/verification-status", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

// ── Zmiana adresu na niezweryfikowanym koncie (za hasłem z rejestracji) ────
export async function changeUnverifiedEmail(data: {
  email: string;
  password: string;
  newEmail: string;
}): Promise<RegisterResponse> {
  return api<RegisterResponse>("/auth/change-unverified-email", {
    method: "POST",
    body: data,
    auth: false,
  });
}

// ── Login ─────────────────────────────────────────────────────────────────
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  await setToken(res.token);
  return res;
}

// ── Google OAuth ──────────────────────────────────────────────────────────
export async function loginWithGoogle(
  credential: string,
): Promise<AuthResponse> {
  const res = await api<AuthResponse>("/auth/google", {
    method: "POST",
    body: { credential },
    auth: false,
  });
  await setToken(res.token);
  return res;
}

// ── Me ────────────────────────────────────────────────────────────────────
export async function getMe(): Promise<User> {
  return api<User>("/auth/me");
}

// ── Forgot password ───────────────────────────────────────────────────────
export async function forgotPassword(
  email: string,
): Promise<{ sent: boolean }> {
  return api("/auth/forgot-password", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

// ── Logout ────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
  await clearToken();
}

// ── Delete account ────────────────────────────────────────────────────
export async function deleteAccount(): Promise<{ deleted: boolean }> {
  const res = await api<{ deleted: boolean }>("/auth/account", {
    method: "DELETE",
  });
  await clearToken();
  return res;
}
