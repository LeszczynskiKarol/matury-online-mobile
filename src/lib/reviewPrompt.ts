// ============================================================================
// In-app review prompt (Google Play In-App Review API przez expo-store-review)
// ----------------------------------------------------------------------------
// Zasada: prosimy o ocenę w momencie maksymalnej satysfakcji. Takich momentów
// są dwa i długo widzieliśmy tylko pierwszy:
//   1. dobrze zdany egzamin (>= MIN_PERCENTAGE),
//   2. utrzymana seria dni nauki (>= MIN_STREAK_DAYS) — uczeń, który codziennie
//      robi sesje, a nigdy nie kończy arkusza, wcześniej nie był pytany ANI RAZU.
// Rate limit po naszej stronie: najwyżej raz na THROTTLE_DAYS, wspólny dla obu
// wyzwalaczy (Play i tak ma własny limit i potrafi cicho nie pokazać dialogu —
// dlatego bez fallbacków i bez własnego UI).
// Wszystko w try/catch: prompt jest opcjonalny, nigdy nie może wywalić
// ekranu wyników.
// ============================================================================

import * as SecureStore from "expo-secure-store";

const KEY = "mo_review_prompt_last";
const MIN_PERCENTAGE = 60;
const MIN_STREAK_DAYS = 3;
const THROTTLE_DAYS = 60;
const SHOW_DELAY_MS = 2500; // niech uczeń najpierw zobaczy swój wynik

let askedThisSession = false;

/** Po serii dni nauki — dla uczniów, którzy nie robią arkuszy. */
export async function maybeAskForReviewOnStreak(
  streakDays: number | null | undefined,
): Promise<void> {
  if (typeof streakDays !== "number" || streakDays < MIN_STREAK_DAYS) return;
  // Próg procentowy nie ma tu sensu — sam fakt serii jest sygnałem.
  await ask();
}

export async function maybeAskForReview(percentage: number): Promise<void> {
  if (typeof percentage !== "number" || percentage < MIN_PERCENTAGE) return;
  await ask();
}

async function ask(): Promise<void> {
  try {
    if (askedThisSession) return;

    const last = await SecureStore.getItemAsync(KEY);
    if (last && Date.now() - Number(last) < THROTTLE_DAYS * 24 * 3600 * 1000) {
      return;
    }

    // Lazy import: statyczny wywalał się na buildach bez natywnego modułu
    // (requireNativeModule rzuca przy załadowaniu bundla, zanim dojdzie do
    // try/catch wywołania).
    const StoreReview = await import("expo-store-review");
    if (!(await StoreReview.hasAction())) return;

    askedThisSession = true;
    await new Promise((r) => setTimeout(r, SHOW_DELAY_MS));
    await StoreReview.requestReview();
    await SecureStore.setItemAsync(KEY, String(Date.now()));
  } catch {
    // brak natywnego modułu (stary build) / brak Play Services — po prostu nic
  }
}
