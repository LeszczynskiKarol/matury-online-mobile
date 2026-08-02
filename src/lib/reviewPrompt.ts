// ============================================================================
// In-app review prompt (Google Play In-App Review API przez expo-store-review)
// ----------------------------------------------------------------------------
// Zasada: prosimy o ocenę w momencie maksymalnej satysfakcji — po dobrze
// zdanym egzaminie (>= MIN_PERCENTAGE). Rate limit po naszej stronie:
// najwyżej raz na THROTTLE_DAYS (Play i tak ma własny limit i potrafi cicho
// nie pokazać dialogu — dlatego bez fallbacków i bez własnego UI).
// Wszystko w try/catch: prompt jest opcjonalny, nigdy nie może wywalić
// ekranu wyników.
// ============================================================================

import * as StoreReview from "expo-store-review";
import * as SecureStore from "expo-secure-store";

const KEY = "mo_review_prompt_last";
const MIN_PERCENTAGE = 60;
const THROTTLE_DAYS = 60;
const SHOW_DELAY_MS = 2500; // niech uczeń najpierw zobaczy swój wynik

let askedThisSession = false;

export async function maybeAskForReview(percentage: number): Promise<void> {
  try {
    if (askedThisSession) return;
    if (typeof percentage !== "number" || percentage < MIN_PERCENTAGE) return;

    const last = await SecureStore.getItemAsync(KEY);
    if (last && Date.now() - Number(last) < THROTTLE_DAYS * 24 * 3600 * 1000) {
      return;
    }

    if (!(await StoreReview.hasAction())) return;

    askedThisSession = true;
    await new Promise((r) => setTimeout(r, SHOW_DELAY_MS));
    await StoreReview.requestReview();
    await SecureStore.setItemAsync(KEY, String(Date.now()));
  } catch {
    // brak natywnego modułu (stary build) / brak Play Services — po prostu nic
  }
}
