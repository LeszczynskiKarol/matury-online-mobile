// ============================================================================
// Globalny ref nawigacji — nawigowanie spoza drzewa komponentów
// (np. tap w powiadomienie push → ekran wyników egzaminu).
// ============================================================================

import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any): void {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as (name: string, params?: any) => void)(
      name,
      params,
    );
  }
}
