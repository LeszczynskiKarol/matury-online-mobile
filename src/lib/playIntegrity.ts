// ============================================================================
// Play Integrity po stronie apki — jednorazowy raport po rejestracji
// src/lib/playIntegrity.ts
//
// Apka pobiera z backendu nonce, prosi Google o token integralności i odsyła
// go do backendu (POST /api/app/integrity-report). Backend ocenia werdykt
// (backend/src/services/play-integrity.ts) — w trybie miękkim konto z
// negatywnym werdyktem wypada tylko ze statystyk, nikomu nie odbieramy dostępu.
//
// Wszystko jest best-effort i CICHE: brak Usług Google, stara wersja Sklepu,
// brak sieci czy odmowa Google nie mogą przeszkodzić w rejestracji ani zalać
// użytkownika komunikatem. Przy błędzie po prostu nic nie wysyłamy.
// ============================================================================

import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "../api/client";

const PACKAGE_ID = "pl.matury_online.app";

export async function reportPlayIntegrity(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    // Wymagane dopiero tutaj: w Expo Go modułu natywnego nie ma, a import
    // na górze pliku wywaliłby cały ekran logowania.
    const mod = require("react-native-google-play-integrity");
    const PlayIntegrity = mod?.default ?? mod;
    if (!PlayIntegrity?.requestIntegrityToken) return;
    if (PlayIntegrity.isPlayIntegrityAvailable) {
      const available = await PlayIntegrity.isPlayIntegrityAvailable().catch(() => false);
      if (!available) return;
    }

    const { nonce } = await api<{ nonce: string }>("/app/integrity-nonce", { auth: false });
    if (!nonce) return;

    const token = await PlayIntegrity.requestIntegrityToken(nonce);
    if (!token) return;

    // `applicationId` z konfiguracji, żeby wariant TEST (…app.test) raportował
    // własną nazwę pakietu, a nie udawał apki ze Sklepu.
    const packageName =
      (Constants.expoConfig as any)?.android?.package || PACKAGE_ID;

    await api("/app/integrity-report", {
      method: "POST",
      body: { token, packageName, nonce },
    });
  } catch {
    // Cicho. Werdyktu nie ma — backend traktuje to jak „nieznany”.
  }
}
