// src/api/exams.ts
import { api } from "./client";

// ── Types ────────────────────────────────────────────────────────────────

export interface ExamInfo {
  id: string;
  title: string;
  examNumber: number;
  maxPoints: number;
  timeMinutes: number;
}

export interface SubjectExamAvailability {
  available: boolean;
  exams: ExamInfo[];
  unseenCount: number;
  completedCount: number;
  timeMinutes: number;
  maxPoints: number;
  subjectName: string;
  level: string;
  message?: string;
}

export interface ExamStartData {
  attemptId: string;
  exam: {
    id: string;
    title: string;
    timeMinutes: number;
    maxPoints: number;
    content: {
      title: string;
      instructions: string;
      parts: any[];
    };
  };
  resumed: boolean;
  savedAnswers: Record<string, any>;
  currentTaskId: string | null;
  startedAt: string;
  timeSpentMs: number;
}

export interface ActiveExamData {
  active: boolean;
  expired?: boolean;
  attemptId?: string;
  examId?: string;
  examTitle?: string;
  timeMinutes?: number;
  startedAt?: string;
  remainingMs?: number;
  remainingMinutes?: number;
  answeredCount?: number;
  message?: string;
}

export interface ExamAttemptHistory {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | "GRADING" | "ABANDONED";
  startedAt: string;
  completedAt: string | null;
  submittedAt: string | null;
  totalScore: number | null;
  percentage: number | null;
  timeSpentMs: number;
  exam: ExamInfo & { level: string };
}

// ── API calls ────────────────────────────────────────────────────────────

export async function getActiveExam(): Promise<ActiveExamData> {
  return api("/exams/active");
}

export async function getAvailableExams(
  subjectId: string,
  level: string = "PODSTAWOWY",
): Promise<SubjectExamAvailability> {
  return api("/exams/available", {
    method: "POST",
    body: { subjectId, level },
  });
}

export async function startExam(examId: string): Promise<ExamStartData> {
  return api(`/exams/${examId}/start`, { method: "POST" });
}

export async function saveExamAnswers(
  attemptId: string,
  data: {
    answers: Record<string, any>;
    currentTaskId?: string;
    timeSpentMs?: number;
  },
): Promise<{ saved?: boolean; alreadySubmitted?: boolean }> {
  return api(`/exams/${attemptId}/save`, {
    method: "POST",
    body: data,
  });
}

export async function submitExam(
  attemptId: string,
  data: {
    answers: Record<string, any>;
    timeSpentMs?: number;
    timeLeftMs?: number;
    skipAiGrading?: boolean;
  },
): Promise<{ attemptId: string; status: string; alreadySubmitted?: boolean }> {
  return api(`/exams/${attemptId}/submit`, {
    method: "POST",
    body: data,
  });
}

export async function gradeExamWithAI(
  attemptId: string,
): Promise<{ status: string; message: string }> {
  return api(`/exams/${attemptId}/grade`, { method: "POST" });
}

export async function resetExam(
  attemptId: string,
): Promise<{ reset: boolean; attemptId: string; examId: string }> {
  return api(`/exams/${attemptId}/reset`, { method: "POST" });
}

export async function getExamResults(attemptId: string): Promise<any> {
  return api(`/exams/${attemptId}/results`);
}

export async function getExamHistory(
  limit: number = 50,
): Promise<ExamAttemptHistory[]> {
  return api("/exams/history", { params: { limit } });
}
