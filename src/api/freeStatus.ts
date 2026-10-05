// ============================================================================
// Co zostało za darmo — GET /api/premium/free-status (backend od 5.10.2026)
// src/api/freeStatus.ts
//
// Konto FREE widzi ten sam pulpit co Premium. Kafle trybów niosą plakietkę
// „1× za darmo” / „1 arkusz za darmo” / „3 nagrania za darmo”, po użyciu
// „Wykorzystany”, i prowadzą do darmowej rzeczy albo jej przeglądu.
// Lustro web: frontend/src/lib/free-status.ts (matury-online.pl).
// ============================================================================

import { api } from "./client";
import type { TrialStatus } from "./premium";

export type FreeQuiz =
  | { state: "available" }
  | {
      state: "in_progress";
      subject: { slug: string; name: string };
      token: string;
      answeredCount: number;
      questionCount: number;
    }
  | {
      state: "used";
      subject: { slug: string; name: string };
      token: string;
      unansweredCount: number;
    };

export interface FreeStatus {
  isPremium: boolean;
  freePackBlocked: boolean;
  quiz: FreeQuiz;
  exam: {
    state: "available" | "in_progress" | "used" | "blocked" | "none";
    trial: TrialStatus;
  };
  listening: {
    state: "available" | "in_progress" | "used" | "blocked";
    sessionId?: string;
    subjectSlug?: string;
    subjectName?: string;
  };
}

export function getFreeStatus(): Promise<FreeStatus> {
  return api<FreeStatus>("/premium/free-status");
}
