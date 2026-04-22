// ============================================================================
// Sessions API — /api/sessions/*
// ============================================================================

import { api } from './client';
import type { Question } from './questions';

export type SessionType = 'PRACTICE' | 'TOPIC_DRILL' | 'REVIEW' | 'MOCK_EXAM' | 'ADAPTIVE';

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
}): Promise<CreateSessionResponse> {
  return api<CreateSessionResponse>('/sessions/create', {
    method: 'POST',
    body: params,
  });
}

export async function completeSession(id: string): Promise<CompleteSessionResponse> {
  return api<CompleteSessionResponse>(`/sessions/${id}/complete`, {
    method: 'POST',
  });
}

export async function getSessionHistory(params?: {
  subjectId?: string;
  limit?: number;
}): Promise<any[]> {
  return api('/sessions/history', { params: params as any });
}

// ============================================================================
// Answers API — /api/answers/*
// ============================================================================

interface SubmitAnswerResponse {
  answerId: string;
  isCorrect: boolean | null;
  score: number | null;
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
  return api<SubmitAnswerResponse>('/answers/submit', {
    method: 'POST',
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
  }[];
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
    type: string;
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
  return api<DashboardData>('/dashboard');
}
