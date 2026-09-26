// ============================================================================
// Sessions API — /api/sessions/*
// ============================================================================

import { api } from "./client";
import type { Question } from "./questions";

export type SessionType =
  | "PRACTICE"
  | "TOPIC_DRILL"
  | "REVIEW"
  | "MOCK_EXAM"
  | "ADAPTIVE";

interface CreateSessionResponse {
  sessionId: string;
  type: SessionType;
  questions: Question[];
  error?: string;
  code?: string;
}

interface CompleteSessionResponse {
  sessionId: string;
  status: string;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  totalXpEarned: number;
  totalTimeMs: number;
}

export async function createSession(params: {
  subjectId: string;
  type: SessionType;
  topicId?: string;
  difficulty?: number;
  questionCount?: number;
  /**
   * Zadanie od korepetytora: serwer serwuje ZAMROŻONY zestaw z zadania
   * (ignoruje topic/count), trwająca sesja wraca bez tworzenia nowej, a
   * dostęp daje miejsce od korepetytora, nie Premium. Błędy: NO_SEAT,
   * SET_NOT_READY, ASSIGNMENT_DONE, ASSIGNMENT_IS_EXAM, ASSIGNMENT_NOT_FOUND.
   */
  assignmentTargetId?: string;
}): Promise<CreateSessionResponse> {
  return api<CreateSessionResponse>("/sessions/create", {
    method: "POST",
    body: params,
  });
}

export async function completeSession(
  id: string,
): Promise<CompleteSessionResponse> {
  return api<CompleteSessionResponse>(`/sessions/${id}/complete`, {
    method: "POST",
  });
}

export async function getSessionHistory(params?: {
  subjectId?: string;
  limit?: number;
}): Promise<any[]> {
  return api("/sessions/history", { params: params as any });
}

// ============================================================================
// Answers API — /api/answers/*
// ============================================================================

interface SubmitAnswerResponse {
  answerId: string;
  isCorrect: boolean | null;
  score: number | null;
  gamification?: {
    xp: number;
    streak: number;
    levelUp?: boolean;
    newLevel?: number;
    badges?: { slug: string; name: string; icon: string; xpReward: number }[];
  };
  pointsEarned: number;
  xpEarned: number;
  explanation: string | null;
  correctAnswer?: any;
  aiGrading?: any;
  streakUpdate?: {
    currentStreak: number;
    isNewRecord: boolean;
  };
  levelUp?: {
    subject: string;
    newLevel: number;
  };
  achievements?: any[];
}

export async function submitAnswer(data: {
  questionId: string;
  sessionId?: string;
  response: any;
  timeSpentMs?: number;
}): Promise<SubmitAnswerResponse> {
  return api<SubmitAnswerResponse>("/answers/submit", {
    method: "POST",
    body: data,
  });
}

// ============================================================================
// Dashboard API — /api/dashboard/*
// ============================================================================

export interface DashboardData {
  user: {
    name: string | null;
    totalXp: number;
    globalLevel: number;
    currentStreak: number;
    longestStreak: number;
    subscriptionStatus: string;
    subscriptionEnd: string | null;
  };
  subjectProgress: {
    subject: {
      slug: string;
      name: string;
      icon: string | null;
      color: string | null;
    };
    level: number;
    xp: number;
    questionsAnswered: number;
    accuracy: number;
    adaptiveDifficulty: number;
    // Kafelek schowany przez ucznia (web: ✕, apka: przytrzymanie).
    hidden?: boolean;
  }[];
  // Stan konta liczony w backendzie (services/account-state.ts).
  account?: import("../components/common/AccountNote").AccountInfo;
  today: {
    questionsCompleted: number;
    xpEarned: number;
    minutesSpent: number;
    targetQuestions: number;
    targetXp: number;
    targetMinutes: number;
    isCompleted: boolean;
  };
  weeklyActivity: {
    date: string;
    questionsCompleted: number;
    xpEarned: number;
    minutesSpent: number;
    isCompleted: boolean;
  }[];
  dueReviews: number;
  recentSessions: {
    id: string;
    subject: { slug: string; name: string; icon: string | null };
    // Temat sesji (lektura / dział), gdy uczeń ćwiczył jeden temat.
    // Backend starszy niż 24.09.2026 nie zwraca pola.
    topic?: { id: string; name: string; slug: string } | null;
    type: string;
    status?: string;
    questionsAnswered: number;
    accuracy: number;
    xpEarned: number;
    completedAt: string;
  }[];
  recentAchievements: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt: string;
  }[];
}

export async function getDashboard(): Promise<DashboardData> {
  return api<DashboardData>("/dashboard");
}
