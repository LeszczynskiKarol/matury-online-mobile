// ============================================================================
// ModeTiles — „Wybierz tryb” na pulpicie (Egzamin Live / Quiz / Słuchanie)
// src/components/home/ModeTiles.tsx
//
// Do 28.09.2026: jeden szeroki kafel Egzaminu i dwa kolorowe pod nim —
// każdy w innym stylu, nic nie pasowało do kart przedmiotów niżej (Karol).
// Teraz jak web „Wybierz tryb” (DashboardHome → QuickModeCard): jednakowe
// karty na neutralnym tle, kolor trybu tylko w ikonie (miękki kwadrat)
// i nazwie, opis w jednym zdaniu i jedna konkretna liczba. Trzy kolumny przy
// 360 dp i dużej czcionce systemowej ucinały polskie nazwy, więc układ to
// lista trzech wierszy (ikona · nazwa + opis + liczba · strzałka) w stylu
// kart przedmiotów (SubjectTile: radius 18, obwódka theme.border).
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../api/client";

/** 7412 → „7 400+” (zaokrąglenie w dół do setki, jak web). */
function floor100(n?: number | null): string | null {
  if (!n || n < 100) return null;
  const v = Math.floor(n / 100) * 100;
  return `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}+`;
}

export type ModeBadgeTone = "free" | "active" | "used" | "locked";
export interface ModeBadge {
  label: string;
  tone: ModeBadgeTone;
}

export function ModeTiles({
  onExam,
  onQuiz,
  onListening,
  badges,
  freeStats,
}: {
  onExam: () => void;
  onQuiz: () => void;
  onListening: () => void;
  /** Konto FREE (od 5.10.2026): „1× za darmo”, „W trakcie”, „Wykorzystany”. */
  badges?: Partial<Record<"exam" | "quiz" | "listening", ModeBadge>>;
  /** Konto FREE: zamiast liczby z banku, np. „Matematyka, poziom podstawowy”. */
  freeStats?: Partial<Record<"exam" | "quiz" | "listening", string>>;
}) {
  const { colors: theme, isDark } = useTheme();
  const [stats, setStats] = useState<{ questions?: number; exams?: number } | null>(null);

  useEffect(() => {
    api<{ questions?: number; exams?: number }>("/public/landing-stats", { auth: false })
      .then((d) => setStats(d ?? null))
      .catch(() => {});
  }, []);

  const modes = [
    {
      key: "exam",
      icon: "📋",
      label: "Egzamin Live",
      description: "Pełne arkusze jak na maturze, z timerem",
      stat: floor100(stats?.exams) ? `${floor100(stats?.exams)} arkuszy` : null,
      tint: isDark ? "rgba(139,92,246,0.18)" : "#ede9fe",
      color: isDark ? "#c4b5fd" : "#6d28d9",
      onPress: onExam,
    },
    {
      key: "quiz",
      icon: "💡",
      label: "Quiz",
      description: "Pytania z wyjaśnieniem po każdej odpowiedzi",
      stat: floor100(stats?.questions) ? `${floor100(stats?.questions)} pytań` : null,
      tint: isDark ? "rgba(34,197,94,0.16)" : "#dcfce7",
      color: isDark ? "#4ade80" : "#16a34a",
      onPress: onQuiz,
    },
    {
      key: "listening",
      icon: "🎧",
      label: "Słuchanie",
      description: "Nagrania po angielsku i niemiecku",
      stat: "bez limitu odsłuchań",
      tint: isDark ? "rgba(20,184,166,0.18)" : "#ccfbf1",
      color: isDark ? "#5eead4" : "#0f766e",
      onPress: onListening,
    },
  ];

  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 1.2,
          color: theme.textTertiary,
          marginBottom: 10,
        }}
      >
        WYBIERZ TRYB
      </Text>
      <View style={{ gap: 10 }}>
        {modes.map((m) => (
          <TouchableOpacity
            key={m.key}
            activeOpacity={0.85}
            onPress={m.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${m.label}. ${m.description}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 14,
              borderRadius: 18,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: m.tint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 24 }}>{m.icon}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: m.color }}>
                  {m.label}
                </Text>
                {badges?.[m.key as "exam" | "quiz" | "listening"] && (() => {
                  const b = badges[m.key as "exam" | "quiz" | "listening"]!;
                  const bg =
                    b.tone === "free"
                      ? isDark ? "rgba(16,185,129,0.18)" : "#d1fae5"
                      : b.tone === "active"
                        ? isDark ? "rgba(34,197,94,0.16)" : "#dcfce7"
                        : isDark ? "rgba(255,255,255,0.08)" : "#f4f4f5";
                  const fg =
                    b.tone === "free"
                      ? isDark ? "#6ee7b7" : "#047857"
                      : b.tone === "active"
                        ? isDark ? "#4ade80" : "#15803d"
                        : theme.textSecondary;
                  return (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: bg }}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: fg }}>
                        {b.tone === "locked" ? "🔒 " : ""}
                        {b.label}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 1, lineHeight: 18 }}>
                {m.description}
              </Text>
              {(freeStats?.[m.key as "exam" | "quiz" | "listening"] ?? m.stat) ? (
                <Text style={{ fontSize: 12, fontWeight: "700", color: theme.text, marginTop: 3 }}>
                  {freeStats?.[m.key as "exam" | "quiz" | "listening"] ?? m.stat}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
