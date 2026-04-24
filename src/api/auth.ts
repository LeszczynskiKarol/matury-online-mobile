// ============================================================================
// Auth API — /api/auth/*
// ============================================================================

import { api, setToken, clearToken } from "./client";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "STUDENT" | "ADMIN";
  subscriptionStatus:
    | "FREE"
    | "ACTIVE"
    | "ONE_TIME"
    | "PAST_DUE"
    | "CANCELLED"
    | "EXPIRED";
  subscriptionEnd: string | null;
  totalXp: number;
  globalLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: string | null;
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
}): Promise<RegisterResponse> {
  return api<RegisterResponse>("/auth/register", {
    method: "POST",
    body: data,
    auth: false,
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
