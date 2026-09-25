// ============================================================================
// FreePanel — jedyna karta na pulpicie darmowego konta
// src/components/common/FreePanel.tsx
//
// Do 25.09.2026 darmowe konto widziało na górze dwa bloki mówiące to samo:
// niebieski „PEŁNY DOSTĘP / Odblokuj cały angielski" z ofertą arkusza w środku,
// ceną i Pakietem, a pod nim „Za darmo na Twoim koncie" znowu z arkuszem
// i diagnozą. „PEŁNY DOSTĘP" z gwiazdką czytało się jak „masz już dostęp".
// Teraz jest JEDNA karta: dwie darmowe rzeczy, każda z jednym zdaniem stanu
// i jednym przyciskiem, a pod nimi jedna linijka o Premium.
// ============================================================================

import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { radius } from "../../theme";
import { api } from "../../api/client";
import {
  getTrialStatus,
  claimTrial,
  type TrialStatus,
} from "../../api/premium";

interface DiagnosisRow {
  subjectSlug: string;
  subjectName: string;
  scorePercent: number | null;
  worstTopicName: string | null;
  token: string;
}

function hoursLeft(ms: number): string {
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  return h === 1 ? "1 godzinę" : h >= 2 && h <= 4 ? `${h} godziny` : `${h} godzin`;
}

export function FreePanel({
  onPremium,
  premiumLabel = "Wszystko bez limitu:",
}: {
  onPremium: () => void;
  premiumLabel?: string;
}) {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const [diagnoses, setDiagnoses] = useState<DiagnosisRow[] | null>(null);
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

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

  const goExams = () =>
    navigation.getParent()?.navigate("ExamTab", { screen: "ExamSelector" });

  const claim = async () => {
    setClaiming(true);
    setClaimError(null);
    try {
      setTrial(await claimTrial("dashboard"));
      goExams();
    } catch (e: any) {
      setClaimError(e?.message || "Nie udało się odebrać arkusza.");
    } finally {
      setClaiming(false);
    }
  };

  // ── Diagnoza: jedno zdanie + jeden przycisk ──────────────────────────────
  const diag = diagnoses[0];
  const diagText = diag
    ? // Bez „najsłabszego działu" — przy 13 pytaniach to zwykle jedno pytanie.
      `Twój wynik: ${diag.scorePercent ?? 0}%.`
    : "13 pytań, ok. 10 minut.";
  const diagCta = diag ? "Zobacz wynik" : "Zrób diagnozę";
  const onDiag = () =>
    navigation.navigate("Diagnosis", diag ? { token: diag.token } : undefined);

  // ── Darmowy arkusz ───────────────────────────────────────────────────────
  const examDone =
    trial?.attemptStatus === "COMPLETED" || trial?.attemptStatus === "GRADING";
  let examText: string;
  let examCta: string | null = null;
  let onExam: (() => void) | null = null;
  if (examDone) {
    examText = "Oddany. Wynik zostaje na stałe.";
    examCta = "Zobacz wynik";
    onExam = () =>
      navigation.getParent()?.navigate("ExamTab", {
        screen: "ExamResults",
        params: { attemptId: trial!.examAttemptId! },
      });
  } else if (trial?.examId) {
    examText = "Zaczęty — dokończ i oddaj.";
    examCta = "Wróć do arkusza";
    onExam = goExams;
  } else if (trial?.active) {
    examText = `Wybierz arkusz — masz na to ${hoursLeft(trial.remainingMs)}.`;
    examCta = "Wybierz arkusz";
    onExam = goExams;
  } else if (trial?.eligible) {
    examText = "Pełny arkusz z oceną AI.";
    examCta = "Odbierz arkusz";
    onExam = claim;
  } else {
    examText = "Już wykorzystany.";
  }

  const row = (
    icon: string,
    title: string,
    text: string,
    cta: string | null,
    onPress: (() => void) | null,
    busy = false,
  ) => (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
            {title}
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 1 }}>
            {text}
          </Text>
        </View>
      </View>
      {cta && onPress && (
        <TouchableOpacity
          onPress={onPress}
          disabled={busy}
          style={{
            backgroundColor: colors.brand[500],
            paddingVertical: 11,
            borderRadius: radius.xl,
            alignItems: "center",
            marginTop: 12,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {cta}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        padding: 18,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: theme.text,
          marginBottom: 14,
        }}
      >
        Za darmo
      </Text>

      {row("📊", "Diagnoza", diagText, diagCta, onDiag)}
      <View
        style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }}
      />
      {row("📝", "Darmowy arkusz", examText, examCta, onExam, claiming)}
      {claimError && (
        <Text style={{ fontSize: 12, color: colors.red[500], marginTop: 8 }}>
          {claimError}
        </Text>
      )}

      <TouchableOpacity
        onPress={onPremium}
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 13, color: theme.textSecondary, flex: 1 }}>
          {premiumLabel}{" "}
          <Text style={{ fontWeight: "800", color: theme.text }}>Premium</Text>
        </Text>
        <Text
          style={{ fontSize: 13, fontWeight: "800", color: colors.brand[500] }}
        >
          od 49 zł/mies. →
        </Text>
      </TouchableOpacity>
    </View>
  );
}
