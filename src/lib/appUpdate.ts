// ============================================================================
// Podpowiedź „jest nowa wersja” — GET /api/app/version-policy
// Backend trzyma najnowszą wersję w tabeli Setting (ustawianą przy wydaniu);
// porównuje ją z X-App-Version, który apka wysyła w każdym requeście.
// Tylko sugestia — nigdy nie blokujemy starszej wersji.
// ============================================================================

import { Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { api } from "../api/client";

const PACKAGE_ID = "pl.matury_online.app";

export interface VersionPolicy {
  latestVersion: string | null;
  currentVersion: string | null;
  storeUrl: string | null;
  updateAvailable: boolean;
}

/** null przy braku sieci/błędzie — wtedy po prostu nic nie proponujemy. */
export async function fetchVersionPolicy(): Promise<VersionPolicy | null> {
  try {
    return await api<VersionPolicy>("/app/version-policy", {
      auth: false,
      timeout: 8000,
    });
  } catch {
    return null;
  }
}

/**
 * Sklep Play wprost (pakiet com.android.vending). Samo `market://` na Xiaomi
 * i innych telefonach z własnym sklepem pokazywało „Wybierz sklep” (GetApps
 * też obsługuje market://) — 27.09.2026. Bez Google Play: strona WWW.
 */
export async function openStore(storeUrl?: string | null): Promise<void> {
  const web = storeUrl || `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`;
  if (Platform.OS === "android") {
    try {
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        // https, nie market:// — MIUI przechwytuje market:// nawet z pakietem
        // Google Play i pokazuje „Wybierz sklep” (sprawdzone na Xiaomi, 27.09.2026).
        data: `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`,
        packageName: "com.android.vending",
      });
      return;
    } catch {
      // brak Google Play na urządzeniu — niżej strona sklepu
    }
  }
  await Linking.openURL(web).catch(() => {});
}
