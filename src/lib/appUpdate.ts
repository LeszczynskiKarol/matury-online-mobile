// ============================================================================
// Podpowiedź „jest nowa wersja” — GET /api/app/version-policy
// Backend trzyma najnowszą wersję w tabeli Setting (ustawianą przy wydaniu);
// porównuje ją z X-App-Version, który apka wysyła w każdym requeście.
// Tylko sugestia — nigdy nie blokujemy starszej wersji.
// ============================================================================

import { Linking } from "react-native";
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

/** Sklep Play: najpierw aplikacja sklepu, potem strona WWW. */
export async function openStore(storeUrl?: string | null): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${PACKAGE_ID}`);
  } catch {
    await Linking.openURL(
      storeUrl || `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`,
    ).catch(() => {});
  }
}
