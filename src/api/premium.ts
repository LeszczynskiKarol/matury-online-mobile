// ============================================================================
// Lejek Premium — intencja zakupu i oferta próbna
// src/api/premium.ts
//
// Port webowych endpointów. Apka gada z TYM SAMYM backendem co web, więc cała
// logika uprawnień (kto się kwalifikuje, jeden arkusz, okno 48h) już tam jest —
// tutaj nie wolno jej powielać ani obchodzić. Klient tylko czyta stan i
// pokazuje właściwy ekran.
// ============================================================================

import { api } from "./client";

export interface TrialStatus {
  eligible: boolean;
  active: boolean;
  claimedAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
  examId: string | null;
  examAttemptId: string | null;
  exam: {
    id: string;
    title: string;
    subjectName: string;
    level: string;
    timeMinutes: number;
    maxPoints: number;
  } | null;
  attemptStatus: string | null;
  creditsGranted: number;
  windowHours: number;
  credits: number;
}

export interface PracticeLinks {
  subject: { slug: string; name: string } | null;
  totalQuestions: number;
  links: {
    area: string | null;
    topicId: string | null;
    topicName: string | null;
    questionCount: number;
  }[];
}

export function getTrialStatus(): Promise<TrialStatus> {
  return api<TrialStatus>("/premium/trial");
}

export function claimTrial(trigger: string): Promise<TrialStatus> {
  return api<TrialStatus>("/premium/trial/claim", {
    method: "POST",
    body: { trigger },
  });
}

export function getPracticeLinks(attemptId: string): Promise<PracticeLinks> {
  return api<PracticeLinks>(`/exams/${attemptId}/practice-links`);
}

/**
 * Log wyświetlenia/kliknięcia paywalla. Świadomie „fire and forget":
 * analityka nie ma prawa wywalić ekranu ani opóźnić renderu, a pojedyncze
 * zgubione zdarzenie niczego nie psuje.
 */
export function logIntent(
  kind: "GATE_VIEW" | "GATE_CLICK",
  mode: string,
): void {
  api("/premium/intent", {
    method: "POST",
    body: { kind, mode, path: `mobile:${mode}` },
  }).catch(() => {});
}
