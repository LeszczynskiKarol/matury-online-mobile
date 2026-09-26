// ============================================================================
// AccountNote — jedna linijka o stanie konta na pulpicie
// src/components/common/AccountNote.tsx
//
// Backend liczy stan konta (services/account-state.ts, pole `account`
// w /api/dashboard) — tu tylko go pokazujemy. Tylko sytuacje, w których uczeń
// ma coś zrobić: dostęp kończy się za ≤ 7 dni, subskrypcja anulowana, płatność
// w Google Play nie przeszła, Premium wygasło. Nieudaną płatność Stripe
// pokazuje PaymentFailedBanner, nowe konto — panel „Za darmo”.
// Ten sam plik w apkach matury / zdaj-angielski / ósmoklasisty.
// ============================================================================

import React from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { radius } from "../../theme";

export interface AccountInfo {
  state: "premium" | "premium_until" | "grace" | "payment_failed" | "expired" | "free";
  isPremium: boolean;
  provider: "stripe" | "play";
  plan: string;
  end: string | null;
  daysLeft: number | null;
  daysSince: number | null;
}

const PLAY_SUBS = "https://play.google.com/store/account/subscriptions";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pl", { day: "numeric", month: "long" }) : "";
const dni = (n: number) => (n === 1 ? "1 dzień" : `${n} dni`);

export function AccountNote({
  account,
  onSubscription,
}: {
  account?: AccountInfo | null;
  onSubscription: () => void;
}) {
  const { colors: theme } = useTheme();
  if (!account) return null;
  const a = account;
  const play = a.provider === "play";
  let text: string | null = null;
  let cta: string | null = null;
  let onPress: (() => void) | null = null;
  let warn = false;

  if (a.state === "premium_until") {
    const left = a.daysLeft !== null ? ` (jeszcze ${dni(a.daysLeft)})` : "";
    if (a.plan === "CANCELLED") {
      text = `Subskrypcja anulowana — Premium do ${fmt(a.end)}${left}.`;
      cta = play ? "Wznów w Sklepie Play" : "Wznów subskrypcję";
      onPress = play ? () => Linking.openURL(PLAY_SUBS) : onSubscription;
    } else if (a.plan !== "ANNUAL" && a.daysLeft !== null && a.daysLeft <= 7) {
      text = `Premium do ${fmt(a.end)}${left}.`;
      cta = "Przedłuż dostęp";
      onPress = onSubscription;
    }
  } else if (a.state === "grace") {
    text = "Płatność w Sklepie Play nie przeszła — dostęp jeszcze trwa.";
    cta = "Zaktualizuj płatność";
    onPress = () => Linking.openURL(PLAY_SUBS);
    warn = true;
  } else if (a.state === "payment_failed" && play) {
    text = "Google Play wstrzymał subskrypcję, bo płatność nie przeszła. Po jej aktualizacji Premium wróci samo.";
    cta = "Otwórz Sklep Play";
    onPress = () => Linking.openURL(PLAY_SUBS);
    warn = true;
  } else if (a.state === "expired") {
    const ago =
      a.daysSince === null ? "" : a.daysSince === 0 ? " dziś" : ` ${dni(a.daysSince)} temu`;
    text = `Twoje Premium wygasło${ago}. Postęp i wyniki czekają na Ciebie.`;
    cta = "Wróć do Premium";
    onPress = onSubscription;
  }
  if (!text) return null;

  const accent = warn ? colors.red[500] : colors.brand[500];
  return (
    <View
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: radius["2xl"],
        borderWidth: 1,
        borderColor: accent + "55",
        backgroundColor: accent + "12",
      }}
    >
      <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>{text}</Text>
      {cta && onPress && (
        <TouchableOpacity onPress={onPress} style={{ marginTop: 8 }} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: accent }}>{cta} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
