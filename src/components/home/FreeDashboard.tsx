// ============================================================================
// Pulpit konta FREE = pulpit Premium (od 5.10.2026)
// src/components/home/FreeDashboard.tsx
//
// Lustro web: frontend/src/components/dashboard/FreeDashboard.tsx
// (matury-online.pl). Konto bez Premium widzi ten sam pulpit; różnice:
//   1. plakietki na kaflach trybów („1× za darmo”, „1 arkusz za darmo”,
//      „3 nagrania za darmo”, „W trakcie”, „Wykorzystany”, „Premium”);
//   2. w miejscu „Kontynuuj naukę” — następny darmowy krok (quiz, potem
//      arkusz); znika, gdy oba są wykorzystane.
// Cele kafli: Quiz → zakładka Quiz (darmowy quiz albo jego przegląd),
// Egzamin → zakładka Egzamin (wybór darmowego arkusza albo jego stan),
// Słuchanie → hub (3 darmowe nagrania albo ich przegląd).
// ============================================================================

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import type { FreeStatus } from "../../api/freeStatus";
import type { ModeBadge } from "./ModeTiles";

/** „Matematyka, poziom podstawowy” — opis przypiętego darmowego arkusza. */
export function freeSheetLabel(exam: any): string | null {
  if (!exam?.subjectName) return null;
  return `${exam.subjectName}${exam.level ? `, poziom ${String(exam.level).toLowerCase()}` : ""}`;
}

/** Zamiast liczby z banku na kaflu Egzamin: który darmowy arkusz. */
export function freeModeStats(st: FreeStatus): Partial<Record<"exam" | "quiz" | "listening", string>> {
  const out: Partial<Record<"exam" | "quiz" | "listening", string>> = {};
  const label =
    st.exam.state === "in_progress" || st.exam.state === "used" ? freeSheetLabel(st.exam.trial.exam) : null;
  if (label) out.exam = label;
  // Zaczęty/zrobiony darmowy quiz: przedmiot; Słuchanie: język (Karol 5.10.2026).
  if (st.quiz.state !== "available") out.quiz = st.quiz.subject.name;
  if ((st.listening.state === "in_progress" || st.listening.state === "used") && st.listening.subjectName)
    out.listening = st.listening.subjectName;
  return out;
}

export function freeModeBadges(
  st: FreeStatus,
): Partial<Record<"exam" | "quiz" | "listening", ModeBadge>> {
  const quiz: ModeBadge =
    st.quiz.state === "available"
      ? { label: "1× za darmo", tone: "free" }
      : st.quiz.state === "in_progress"
        ? { label: "W trakcie", tone: "active" }
        : { label: "Wykorzystany", tone: "used" };
  const exam: ModeBadge =
    st.exam.state === "available"
      ? { label: "1 arkusz za darmo", tone: "free" }
      : st.exam.state === "in_progress"
        ? { label: "W trakcie", tone: "active" }
        : st.exam.state === "used"
          ? { label: "Wykorzystany", tone: "used" }
          : { label: "Premium", tone: "locked" };
  const listening: ModeBadge =
    st.listening.state === "available"
      ? { label: "3 nagrania za darmo", tone: "free" }
      : st.listening.state === "in_progress"
        ? { label: "W trakcie", tone: "active" }
        : st.listening.state === "used"
          ? { label: "Wykorzystany", tone: "used" }
          : { label: "Premium", tone: "locked" };
  return { quiz, exam, listening };
}

/** Karta następnego darmowego kroku — w miejscu „Kontynuuj naukę”. */
export function FreeNextStep({
  status,
  navigation,
  style,
}: {
  status: FreeStatus | null;
  navigation: any;
  style?: any;
}) {
  const { colors: theme } = useTheme();
  if (!status) return null;
  const q = status.quiz;
  const e = status.exam;

  let step: { icon: string; title: string; text: string; go: () => void } | null = null;
  if (q.state === "in_progress") {
    step = {
      icon: "💡",
      title: `Kontynuuj darmowy quiz: ${q.subject.name} · ${q.answeredCount}/${q.questionCount}`,
      text: "Odpowiedzi są zapisane, wracasz od kolejnego zadania.",
      go: () => navigation.navigate("QuizTab", { screen: "QuizSetup" }),
    };
  } else if (q.state === "available") {
    step = {
      icon: "💡",
      title: "Zacznij od darmowego quizu",
      text: "Kilkanaście zadań z wybranego przedmiotu, każde od razu ocenione.",
      go: () => navigation.navigate("QuizTab", { screen: "QuizSetup" }),
    };
  } else if (e.state === "in_progress" && e.trial.examId) {
    step = {
      icon: "📋",
      title: `Kontynuuj darmowy arkusz${freeSheetLabel(e.trial.exam) ? `: ${freeSheetLabel(e.trial.exam)}` : ""}`,
      text: e.trial.exam?.title ? `${e.trial.exam.title} · bez limitu czasu` : "Bez limitu czasu, odpowiedzi zapisują się same.",
      go: () =>
        navigation.navigate("ExamTab", {
          screen: "ExamPlay",
          params: { examId: e.trial.examId!, subjectId: "" },
        }),
    };
  } else if (e.state === "available") {
    step = {
      icon: "📋",
      title: "Rozwiąż darmowy arkusz maturalny",
      text: "Pełny arkusz bez zegara, z punktacją według klucza.",
      go: () => navigation.navigate("ExamTab", { screen: "ExamSelector" }),
    };
  }
  if (!step) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={step.go}
      accessibilityRole="button"
      accessibilityLabel={step.title}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: 20,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.cardBorder ?? theme.border,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.brand[500] + "26",
        }}
      >
        <Text style={{ fontSize: 18 }}>{step.icon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "700", color: theme.text }}>
          {step.title}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
          {step.text}
        </Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.brand[500] }}>→</Text>
    </TouchableOpacity>
  );
}
