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
    // Od 2.09.2026 backend nazywa arkusz wprost — pasek gracza pokazuje
    // przedmiot i poziom zamiast samego licznika zadań. Pola opcjonalne,
    // żeby apka działała też ze starszym backendem.
    subjectName?: string | null;
    subjectSlug?: string | null;
    level?: "PODSTAWOWY" | "ROZSZERZONY" | null;
    timeMinutes: number;
    maxPoints: number;
    content: {
      title: string;
      instructions: string;
      parts: any[];
    };
  };
  resumed: boolean;
  /** Arkusz z darmowej oferty — bez zegara ściennego (backend: exam-live.ts). */
  untimed?: boolean;
  savedAnswers: Record<string, any>;
  currentTaskId: string | null;
  startedAt: string;
  timeSpentMs: number;
}

/** Arkusz w toku (od 26.09.2026 może ich być kilka naraz). */
export interface InProgressAttempt {
  attemptId: string;
  examId: string;
  examTitle: string;
  subjectSlug: string | null;
  subjectName: string | null;
  subjectIcon: string | null;
  level: string;
  timeMinutes: number;
  untimed?: boolean;
  remainingMs: number;
  remainingMinutes: number;
  answeredCount: number;
}

export interface ActiveExamData {
  active: boolean;
  /** Wszystkie arkusze w toku; pola wyżej/niżej = najnowszy (zgodność). */
  attempts?: InProgressAttempt[];
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
    /** Pusty arkusz → porzucony (ABANDONED) zamiast pustego wyniku. */
    discardIfEmpty?: boolean;
  },
): Promise<{ attemptId: string; status: string; alreadySubmitted?: boolean }> {
  return api(`/exams/${attemptId}/submit`, {
    method: "POST",
    body: data,
  });
}

/** Porzuć arkusz — wraca na listę do rozwiązania, bez wyniku i kredytów. */
export async function discardExam(
  attemptId: string,
): Promise<{ attemptId: string; status: string }> {
  return api(`/exams/${attemptId}/discard`, { method: "POST", body: {} });
}

/** Ile kredytów zejdzie za ocenę AI przy tych odpowiedziach i czy starczy. */
export async function estimateExam(
  attemptId: string,
  answers: Record<string, any>,
): Promise<{ credits: number; remaining: number; enough: boolean; answered: number }> {
  return api(`/exams/${attemptId}/estimate`, { method: "POST", body: { answers } });
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
