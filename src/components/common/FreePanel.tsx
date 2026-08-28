// ============================================================================
// FreePanel — „co mam za darmo" dla konta bez Premium (port z webu)
// src/components/common/FreePanel.tsx
//
// Darmowe konto w apce widziało wyłącznie zablokowany panel, wyszarzone
// przedmioty i cenę — czyli ścianę. Ten panel zbiera obie darmowe rzeczy i
// pokazuje ICH STAN, dzięki czemu darmowy tier staje się ścieżką zamiast muru.
//
// Diagnoza nie ma jeszcze natywnego ekranu, więc otwieramy ją w przeglądarce
// w systemie — sesja jest ta sama (cookie), a API diagnozy jest w całości
// serwerowe. To świadomy etap pośredni, nie docelowy kształt.
// ============================================================================

import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { radius } from "../../theme";
import { api, API_BASE_URL } from "../../api/client";
import { getTrialStatus, type TrialStatus } from "../../api/premium";

interface DiagnosisRow {
  subjectSlug: string;
  subjectName: string;
  scorePercent: number | null;
  worstTopicName: string | null;
  token: string;
}

type Tone = "done" | "active" | "todo";

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const bg =
    tone === "done"
      ? "#10b98122"
      : tone === "active"
        ? colors.brand[500] + "22"
        : "#71717a22";
  const fg =
    tone === "done" ? "#10b981" : tone === "active" ? colors.brand[500] : "#a1a1aa";
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: "800", color: fg }}>{label}</Text>
    </View>
  );
}

export function FreePanel() {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const [diagnoses, setDiagnoses] = useState<DiagnosisRow[] | null>(null);
  const [trial, setTrial] = useState<TrialStatus | null>(null);

  // useFocusEffect, nie useEffect: diagnoza otwiera się w przeglądarce
  // systemowej, więc user wraca do apki z NOWYM stanem po stronie serwera.
  // Pobranie tylko przy montowaniu zostawiałoby go z widokiem „Do zrobienia"
  // tuż po tym, jak diagnozę zrobił.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api<{ diagnoses: DiagnosisRow[] }>("/diagnosis/mine")
        .then((d) => !cancelled && setDiagnoses(d?.diagnoses ?? []))
        .catch(() => !cancelled && setDiagnoses([]));
      getTrialStatus()
        .then((t) => !cancelled && setTrial(t))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (diagnoses === null) return null;

  // ?app=1 mówi stronie, że otwiera ją aplikacja mobilna — wtedy nie
  // pokazuje CTA prowadzącego do płatności na stronie. Google Play zabrania
  // wyprowadzania użytkownika apki do zakupu poza swoim systemem, a diagnoza
  // to jedyne miejsce, w którym apka w ogóle otwiera przeglądarkę.
  const openWeb = (path: string) => {
    const url = `${API_BASE_URL}${path}${path.includes("?") ? "&" : "?"}app=1`;
    WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  const goExams = () =>
    navigation.getParent()?.navigate("ExamTab", { screen: "ExamSelector" });

  const examDone =
    trial?.attemptStatus === "COMPLETED" || trial?.attemptStatus === "GRADING";

  const card = {
    backgroundColor: theme.card,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    marginBottom: 10,
  } as const;

  const cta = {
    backgroundColor: colors.brand[500],
    paddingVertical: 11,
    borderRadius: radius.xl,
    alignItems: "center",
    marginTop: 12,
  } as const;

  const ctaText = { color: "#fff", fontWeight: "800", fontSize: 13 } as const;
  const body = {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
  } as const;

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }}>
        Za darmo na Twoim koncie
      </Text>
      <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 14 }}>
        Dwie rzeczy bez żadnej opłaty. Wyniki zostają u Ciebie na stałe.
      </Text>

      {/* ── Diagnoza ────────────────────────────────────────────────── */}
      <View style={card}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
            📊 Diagnoza
          </Text>
          {/* Diagnoza jest JEDNA na konto — bez liczników i bez zachęty do
              kolejnych przedmiotów. */}
          <StatusPill
            label={diagnoses.length > 0 ? "Zrobiona" : "Do zrobienia"}
            tone={diagnoses.length > 0 ? "done" : "todo"}
          />
        </View>

        {diagnoses.length === 0 ? (
          <>
            <Text style={body}>
              13 pytań z wybranego przedmiotu. Dowiesz się, czy przekraczasz
              próg 30% i które działy leżą najbardziej.
            </Text>
            <TouchableOpacity style={cta} onPress={() => openWeb("/diagnoza")}>
              <Text style={ctaText}>Zrób diagnozę →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={body}>
              <Text style={{ fontWeight: "800", color: theme.text }}>
                {diagnoses[0].subjectName}
              </Text>{" "}
              —{" "}
              <Text
                style={{
                  fontWeight: "800",
                  color: (diagnoses[0].scorePercent ?? 0) >= 30 ? "#10b981" : "#ef4444",
                }}
              >
                {diagnoses[0].scorePercent ?? 0}%
              </Text>
              {diagnoses[0].worstTopicName
                ? ` · najsłabszy dział: ${diagnoses[0].worstTopicName}`
                : ""}
            </Text>
            <TouchableOpacity
              style={cta}
              onPress={() =>
                openWeb(
                  `/diagnoza/wynik?token=${encodeURIComponent(diagnoses[0].token)}`,
                )
              }
            >
              <Text style={ctaText}>Zobacz pełny wynik →</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Darmowy arkusz ──────────────────────────────────────────── */}
      <View style={card}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
            📝 Darmowy arkusz
          </Text>
          <StatusPill
            label={
              examDone
                ? "Zrobione"
                : trial?.examId
                  ? "W trakcie"
                  : trial?.active
                    ? "Odblokowane"
                    : "Do odebrania"
            }
            tone={examDone ? "done" : trial?.examId || trial?.active ? "active" : "todo"}
          />
        </View>

        {examDone ? (
          <>
            <Text style={body}>
              {trial?.exam?.title ?? "Arkusz"} — oddany. Wynik i feedback AI
              zostają na stałe.
            </Text>
            <TouchableOpacity
              style={cta}
              onPress={() =>
                navigation.getParent()?.navigate("ExamTab", {
                  screen: "ExamResults",
                  params: { attemptId: trial!.examAttemptId! },
                })
              }
            >
              <Text style={ctaText}>Zobacz wynik →</Text>
            </TouchableOpacity>
          </>
        ) : trial?.examId ? (
          <>
            <Text style={body}>
              {trial.exam?.title ?? "Arkusz"} — zaczęty, jeszcze nieoddany.
            </Text>
            <TouchableOpacity style={cta} onPress={goExams}>
              <Text style={ctaText}>Wróć do arkusza →</Text>
            </TouchableOpacity>
          </>
        ) : trial?.active ? (
          <>
            <Text style={body}>
              Masz odblokowany jeden pełny arkusz i {trial.credits} kredytów AI.
              Wybór jest jednorazowy.
            </Text>
            <TouchableOpacity style={cta} onPress={goExams}>
              <Text style={ctaText}>Wybierz arkusz →</Text>
            </TouchableOpacity>
          </>
        ) : trial?.eligible ? (
          <Text style={body}>
            Pełny arkusz maturalny z timerem i oceną AI. Odbierz go na karcie
            powyżej — bez karty, jednorazowo.
          </Text>
        ) : (
          <Text style={body}>
            Darmowy arkusz przysługuje raz na konto i został wykorzystany.
            Kolejne arkusze — bez limitu — są w Premium.
          </Text>
        )}
      </View>
    </View>
  );
}
