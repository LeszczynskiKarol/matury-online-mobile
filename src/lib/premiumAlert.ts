// ============================================================================
// Komunikat o braku dostępu Premium — jeden dla całej apki
// src/lib/premiumAlert.ts
//
// Backend odrzuca zapis odpowiedzi, start arkusza i ocenę wypracowania kodem
// PREMIUM_REQUIRED. Ekrany pokazywały wtedy „Błąd" z surowym komunikatem
// serwera — ślepy zaułek bez żadnej oferty (zgłoszone 17.09.2026). Tu jest
// jedna treść i jedno przejście na ekran Subskrypcja, gdzie stoi Pakiet.
// ============================================================================

import { Alert } from "react-native";

/**
 * Obsługuje błąd „brak Premium". Zwraca true, gdy to był ten przypadek
 * (wywołujący nie pokazuje wtedy własnego komunikatu).
 */
export function handlePremiumError(
  err: any,
  navigation: any,
  opts: { onRefresh?: () => void; goBack?: boolean } = {},
): boolean {
  const premium =
    err?.code === "PREMIUM_REQUIRED" ||
    /premium required|subskrypcji premium/i.test(String(err?.message ?? ""));
  if (!premium) return false;

  opts.onRefresh?.();
  Alert.alert(
    "Potrzebny dostęp Premium",
    "Twój dostęp wygasł albo został zakończony. Postępy, seria i powtórki są zachowane — wrócą razem z dostępem.",
    [
      {
        text: "Później",
        style: "cancel",
        onPress: () => {
          if (opts.goBack) navigation?.goBack?.();
        },
      },
      {
        text: "Zobacz plany",
        onPress: () =>
          navigation?.getParent?.()?.navigate("ProfileTab", { screen: "Subscription" }),
      },
    ],
  );
  return true;
}
