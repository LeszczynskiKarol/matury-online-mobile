// ============================================================================
// DashboardUnlockBox — blok „odblokuj naukę” na pulpicie konta bez Premium
// src/components/home/DashboardUnlockBox.tsx
//
// Lustro web PremiumGate (tryb „dashboard”): nagłówek, trzy korzyści
// i jedno wezwanie z ceną (bez próbki pytania — Karol 29.09.2026). Stoi POD
// kartą „Za darmo” (najpierw darmowa diagnoza i arkusz). Wcześniej darmowe
// konto widziało o Premium tylko drobną linijkę „od 49 zł/mies.” na dole
// karty „Za darmo” (Karol 28.09.2026). Byłe konto (wygasłe / anulowane)
// i uczeń od korepetytora dostają copy jak na webie (variantCopy).
// Zakup idzie przez ekran Subskrypcji (Google Play Billing).
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { api } from "../../api/client";

function floor100(n?: number | null): string {
  if (!n || n < 100) return "7 000+";
  const v = Math.floor(n / 100) * 100;
  return `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}+`;
}

export function DashboardUnlockBox({
  onUnlock,
  subscriptionStatus,
  hasTutor,
}: {
  onUnlock: () => void;
  subscriptionStatus?: string | null;
  hasTutor?: boolean;
}) {
  const { colors: theme, isDark } = useTheme();
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    api<{ total?: number }>("/public/question-counts", { auth: false })
      .then((d) => typeof d?.total === "number" && setTotal(d.total))
      .catch(() => {});
  }, []);

  const st = String(subscriptionStatus ?? "").toUpperCase();
  const former = st === "EXPIRED" || st === "CANCELLED" || st === "ONE_TIME" || st === "ANNUAL";
  const copy = hasTutor
    ? {
        headline: "Zadania od korepetytora już masz. Chcesz ćwiczyć też między lekcjami?",
        bullets: [
          "Zadania od korepetytora rozwiązujesz bez ograniczeń",
          "Premium dokłada cały bank pytań ze wszystkich działów, arkusze z timerem, ocenę wypracowań i słuchanie",
          "System dobiera pytania pod Twoje braki, a postępy widzi też korepetytor",
        ],
        cta: "Odblokuj resztę",
      }
    : former
      ? {
          headline: "Wróć do nauki przed maturą",
          bullets: [
            "Twoje konto i postępy nadal tu są: XP, seria i historia sesji",
            "System dobierze pytania od nowa pod Twoje aktualne braki",
            "Pełne arkusze z timerem i oceną według kryteriów CKE",
          ],
          cta: "Wznów dostęp",
        }
      : {
          headline: "Twoje konto jest gotowe: odblokuj naukę do matury",
          bullets: [
            `${floor100(total)} pytań z 12 przedmiotów, dobieranych pod Twoje braki`,
            "Nielimitowane arkusze z timerem i oceną według kryteriów CKE",
            "Słuchanie bez limitu nagrań: każde zadanie jest inne",
          ],
          cta: "Odblokuj pełny dostęp",
        };

  return (
    <View
      style={{
        marginBottom: 24,
        padding: 18,
        borderRadius: 24,
        backgroundColor: theme.card,
        borderWidth: 2,
        borderColor: isDark ? colors.brand[800] + "80" : colors.brand[200],
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: isDark ? 0 : 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 1,
          color: isDark ? colors.brand[300] : colors.brand[700],
          marginBottom: 6,
        }}
      >
        PREMIUM
      </Text>
      <Text
        style={{
          fontSize: 21,
          fontWeight: "800",
          color: theme.text,
          lineHeight: 27,
          marginBottom: 12,
        }}
      >
        {copy.headline}
      </Text>
      <View style={{ gap: 8, marginBottom: 14 }}>
        {copy.bullets.map((b) => (
          <View key={b} style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.brand[500] }}>✓</Text>
            <Text style={{ flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>{b}</Text>
          </View>
        ))}
      </View>
      {/* Wezwanie z ceną w dwóch wierszach — w jednym „Odblokuj dostęp —
          od 49 zł/mies.” łamało się krzywo przy dużej czcionce na 360 dp. */}
      <TouchableOpacity
        onPress={onUnlock}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${copy.cta} — od 49 zł miesięcznie`}
        style={{
          backgroundColor: colors.brand[500],
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff", textAlign: "center" }}>
          {copy.cta} →
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.9)", marginTop: 1 }}>
          od 49 zł/mies.
        </Text>
      </TouchableOpacity>
    </View>
  );
}
