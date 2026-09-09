// ============================================================================
// Usage — zdarzenia klienckie do analityki użycia (panel admina → Użycie).
//
// Backend sam widzi każdą akcję (odpowiedź, arkusz, zakup) po route'ach, więc
// apka wysyła tylko to, czego serwer nie zobaczy: powrót na pierwszy plan
// i zmianę ekranu. Nazwy muszą być na allowliście w backend/routes/usage.ts.
// Wszystko fire-and-forget — analityka nigdy nie może zepsuć nauki.
// ============================================================================

import { AppState, type AppStateStatus } from "react-native";
import { api, getToken } from "../api/client";

export type ClientEvent =
  | "app_open"
  | "screen_view"
  | "explanation_open"
  | "feature_click"
  | "share"
  | "notification_open"
  | "review_prompt";

export function trackUsage(name: ClientEvent, props?: Record<string, unknown>): void {
  api("/usage/track", { method: "POST", body: { name, props }, timeout: 8000 }).catch(
    () => {},
  );
}

let lastScreen: string | null = null;

/** Wołać z NavigationContainer.onStateChange — deduplikuje ten sam ekran. */
export function trackScreen(name: string | undefined): void {
  if (!name || name === lastScreen) return;
  lastScreen = name;
  trackUsage("screen_view", { screen: name });
}

/**
 * Powrót apki na pierwszy plan: heartbeat (lastActiveAt + „active" per
 * platforma po stronie serwera) i app_open. Zwraca funkcję sprzątającą.
 */
export function installAppStateTracking(): () => void {
  const onChange = async (state: AppStateStatus) => {
    if (state !== "active") return;
    trackUsage("app_open");
    if (await getToken()) {
      api("/auth/heartbeat", { method: "POST", timeout: 8000 }).catch(() => {});
    }
  };
  void onChange(AppState.currentState);
  const sub = AppState.addEventListener("change", onChange);
  return () => sub.remove();
}
