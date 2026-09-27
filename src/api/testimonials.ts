// ============================================================================
// Opinie uczniów — wspólny backend (matury-online.pl/backend/src/routes/
// testimonials.ts). Marka opinii bierze się z nagłówka X-Brand (api/client.ts).
// ============================================================================

import { api } from "./client";

export type TestimonialTrigger = "exam" | "streak" | "diagnosis";

export interface TestimonialEligibility {
  eligible: boolean;
  existing: { id: string; status: string; createdAt: string } | null;
}

export interface TestimonialPayload {
  trigger: TestimonialTrigger;
  context?: Record<string, unknown>;
  rating?: number | null;
  quote?: string;
  consentPublic?: boolean;
  authorLabel?: string;
}

/** Czy pytać to konto — backend pyta raz (każda zapisana opinia blokuje). */
export function getTestimonialEligibility() {
  return api<TestimonialEligibility>("/testimonials/eligibility");
}

/** Wyświetlenie prośby — panel opinii liczy z tego widoki. */
export function trackTestimonialImpression(trigger: TestimonialTrigger) {
  return api<{ ok: boolean }>("/testimonials/impression", {
    method: "POST",
    body: { trigger },
  });
}

/**
 * Zapis opinii. Pierwsze wywołanie (sama ocena) tworzy wpis, kolejne nadpisuje
 * go, dopóki czeka na moderację. 400 = za krótki/długi tekst, 409 = opinia
 * z tego konta już zatwierdzona/odrzucona.
 */
export function submitTestimonial(payload: TestimonialPayload) {
  return api<{ ok: boolean; testimonial: { id: string; status: string } }>(
    "/testimonials",
    { method: "POST", body: payload },
  );
}
