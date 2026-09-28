// ============================================================================
// DashboardUnlockBox — blok „odblokuj naukę” na pulpicie konta bez Premium
// src/components/home/DashboardUnlockBox.tsx
//
// Lustro web PremiumGate (tryb „dashboard”): nagłówek, trzy korzyści,
// próbka pytania do kliknięcia i jedno wezwanie z ceną. Wcześniej darmowe
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

/** Próbka pytania — jak web MiniQuizPreview: wybór pokazuje wyjaśnienie. */
function MiniQuizPreview() {
  const { colors: theme, isDark } = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  const options = [
    { id: "A", text: "x = 2", ok: false },
    { id: "B", text: "x = 3", ok: true },
    { id: "C", text: "x = 6", ok: false },
  ];
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.surface[50],
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: theme.textTertiary, marginBottom: 6 }}>
        SPRÓBUJ — TAK WYGLĄDA PYTANIE:
      </Text>
      <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text, marginBottom: 10 }}>
        Rozwiązaniem równania 2x − 1 = 5 jest:
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const state =
            picked === null ? "idle" : o.ok ? "ok" : picked === o.id ? "bad" : "dim";
          return (
            <TouchableOpacity
              key={o.id}
              onPress={() => setPicked(o.id)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor:
                  state === "ok"
                    ? colors.brand[500]
                    : state === "bad"
                      ? "#f87171"
                      : theme.border,
                backgroundColor:
                  state === "ok"
                    ? isDark ? "rgba(34,197,94,0.15)" : colors.brand[50]
                    : state === "bad"
                      ? isDark ? "rgba(239,68,68,0.15)" : "#fef2f2"
                      : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color:
                    state === "ok"
                      ? isDark ? "#4ade80" : colors.brand[700]
                      : state === "bad"
                        ? isDark ? "#f87171" : "#dc2626"
                        : state === "dim"
                          ? theme.textTertiary
                          : theme.textSecondary,
                }}
              >
                {o.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {picked && (
        <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginTop: 10 }}>
          {picked === "B" ? "✅ Dokładnie tak!" : "❌ Poprawnie: x = 3."} 2x = 6, więc x = 3.
          Każde pytanie ma takie wyjaśnienie — a przy Premium dodatkowo
          tłumaczenie AI krok po kroku.
        </Text>
      )}
    </View>
  );
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
            "Pełne arkusze z timerem i ocena wypracowań przez AI",
          ],
          cta: "Wznów dostęp",
        }
      : {
          headline: "Twoje konto jest gotowe — odblokuj naukę",
          bullets: [
            `${floor100(total)} pytań z 12 przedmiotów, dobieranych pod Twoje braki`,
            "Pełne arkusze z timerem + ocena wypracowań przez AI w 30 sekund",
            "Słuchanie z nagraniami AI, serie i statystyki",
          ],
          cta: "Odblokuj dostęp",
        };

  return (
    <View
      style={{
        marginBottom: 20,
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
      {!hasTutor && !former && (
        <View style={{ marginBottom: 16 }}>
          <MiniQuizPreview />
        </View>
      )}
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
      {!hasTutor && (
        <Text
          style={{
            fontSize: 12,
            color: theme.textSecondary,
            textAlign: "center",
            lineHeight: 18,
            marginTop: 10,
          }}
        >
          Najpierw chcesz sprawdzić apkę? Darmowa diagnoza (13 zadań z oceną)
          i jeden darmowy arkusz są w karcie „Za darmo” niżej.
        </Text>
      )}
    </View>
  );
}
