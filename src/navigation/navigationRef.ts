// ============================================================================
// Globalny ref nawigacji — nawigowanie spoza drzewa komponentów
// (np. tap w powiadomienie push → ekran wyników egzaminu).
//
// Tap w powiadomienie przy zimnym starcie przychodzi, zanim kontener nawigacji
// jest gotowy — wtedy zapamiętujemy cel i wykonujemy go w onReady
// (flushPendingNavigation w App.tsx). Wcześniej taki tap ginął.
// ============================================================================

import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

let pending: { name: string; params?: any } | null = null;

export function navigate(name: string, params?: any): void {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as (name: string, params?: any) => void)(
      name,
      params,
    );
  } else {
    pending = { name, params };
  }
}

/** Wołane z NavigationContainer.onReady — wykonuje odłożoną nawigację. */
export function flushPendingNavigation(): void {
  if (!pending || !navigationRef.isReady()) return;
  const p = pending;
  pending = null;
  // Stos „Main” pojawia się dopiero po sprawdzeniu sesji — czekamy na niego
  // (do ~8 s), zamiast nawigować w próżnię.
  let tries = 0;
  const attempt = () => {
    const names: string[] = (navigationRef.getRootState() as any)?.routeNames ?? [];
    if (names.includes(p.name)) {
      navigate(p.name, p.params);
    } else if (++tries < 20) {
      setTimeout(attempt, 400);
    }
  };
  setTimeout(attempt, 200);
}
