// ============================================================================
// Lejek Premium — intencja zakupu i oferta próbna
// src/api/premium.ts
//
// Port webowych endpointów. Apka gada z TYM SAMYM backendem co web, więc cała
// logika uprawnień (kto się kwalifikuje, jeden arkusz na konto) już tam jest —
// tutaj nie wolno jej powielać ani obchodzić. Klient tylko czyta stan i
// pokazuje właściwy ekran.
// ============================================================================

import { api } from "./client";

export interface TrialStatus {
  eligible: boolean;
  /** Każda odebrana oferta — bez terminu na otwarcie arkusza. */
  active: boolean;
  claimedAt: string | null;
  /** @deprecated Zawsze null — oferta nie ma już terminu. */
  expiresAt: string | null;
  /** @deprecated Stała wartość tylko dla starych buildów (bez OTA) — nowy kod jej nie czyta. */
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
  /** @deprecated Tylko dla starych buildów (bez OTA) — nowy kod tego nie czyta. */
  windowHours: number;
  credits: number;
  /** Darmowy pakiet startowy wykorzystany już z tej sieci / Gmaila /
   *  urządzenia — konto nie dostanie arkusza ani kredytów, może kupić Premium.
   *  Brak pola (starszy backend) = false. */
  freePackBlocked?: boolean;
  freePackReason?: FreePackReason;
  freePackMessage?: string;
  code?: string;
}

export type FreePackReason = "device" | "gmail" | "network" | null;

/** Kod błędu/stanu z backendu, gdy darmowy pakiet już poszedł. */
export const FREE_PACK_USED_CODE = "FREE_PACK_USED_NETWORK";

/** Stały tekst dla konta bez prawa do darmowego pakietu. */
export const FREE_PACK_BLOCKED_MESSAGE =
  "Darmowa oferta startowa była już wykorzystana z tej sieci lub urządzenia. Pełny dostęp odblokujesz w Premium.";

/** Czy odpowiedź/błąd oznacza „darmowy pakiet już wykorzystany". Nie rzuca. */
export function isFreePackBlocked(x: any): boolean {
  try {
    return (
      x?.freePackBlocked === true ||
      x?.code === FREE_PACK_USED_CODE ||
      x?.data?.code === FREE_PACK_USED_CODE
    );
  } catch {
    return false;
  }
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

/**
 * `subject` — slug przedmiotu wybranego przed odebraniem (FreeSheetPicker).
 * Backend zapisuje go w logu, a w zdaj ustawia ścieżkę konta bez ścieżki.
 */
export function claimTrial(trigger: string, subject?: string): Promise<TrialStatus> {
  return api<TrialStatus>("/premium/trial/claim", {
    method: "POST",
    body: subject ? { trigger, subject } : { trigger },
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
