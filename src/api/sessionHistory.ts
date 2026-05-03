// ============================================================================
// Session History API — /api/sessions/my-history, /api/sessions/:id/history
// src/api/sessionHistory.ts
// ============================================================================

import { api } from "./client";

export interface SessionSummary {
  id: string;
  type: string;
  status: string;
  subject: {
    id: string;
    slug: string;
    name: string;
    icon: string;
    color: string;
  };
  questionCount: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  totalXpEarned: number;
  totalTimeMs: number;
  startedAt: string;
  completedAt: string | null;
  actionBreakdown: Record<string, number>;
  aiCreditsUsed: number;
  totalAnswers: number;
}

export interface SessionTimelineItem {
  type: "answer" | "viewed_only";
  action: "ANSWERED" | "SKIPPED" | "REVEALED" | "VIEWED";
  questionId: string;
  question: {
    id: string;
    type: string;
    difficulty: number;
    points: number;
    content: any;
    explanation: string | null;
    source: string | null;
    topic: { id: string; name: string; slug: string };
  };
  response: any;
  isCorrect: boolean | null;
  score: number | null;
  pointsEarned: number;
  xpEarned: number;
  aiGrading: any;
  aiCreditsUsed: number;
  timeSpentMs: number | null;
  viewedAt: string;
  answeredAt: string | null;
}

export interface SessionDetailData {
  session: {
    id: string;
    type: string;
    status: string;
    subject: {
      id: string;
      slug: string;
      name: string;
      icon: string;
      color: string;
    };
    questionCount: number;
    questionsAnswered: number;
    correctAnswers: number;
    accuracy: number;
    totalXpEarned: number;
    totalTimeMs: number;
    startedAt: string;
    completedAt: string | null;
  };
  timeline: SessionTimelineItem[];
  stats: {
    totalViewed: number;
    answered: number;
    skipped: number;
    revealed: number;
    viewedOnly: number;
    totalAiCredits: number;
    totalXp: number;
  };
}

export async function getMySessionHistory(params?: {
  subjectId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ sessions: SessionSummary[]; total: number }> {
  return api("/sessions/my-history", { params: params as any });
}

export async function getSessionDetail(id: string): Promise<SessionDetailData> {
  return api(`/sessions/${id}/history`);
}
