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
  isFreePackBlocked,
  FREE_PACK_BLOCKED_MESSAGE,
  type TrialStatus,
} from "../../api/premium";
import { FreeSheetPicker } from "./FreeSheetPicker";
import { openFreeSheet } from "../../lib/openFreeSheet";
import {
  FS_CTA_UNAVAILABLE,
  FS_MSG_NOT_ELIGIBLE,
} from "../../lib/freeSheet";

interface DiagnosisRow {
  subjectSlug: string;
  subjectName: string;
  scorePercent: number | null;
  worstTopicName: string | null;
  token: string;
}

export function FreePanel({
  onPremium,
  premiumLabel = "Wszystko bez limitu:",
  hidePremiumLine = false,
}: {
  onPremium: () => void;
  premiumLabel?: string;
  /** Pulpit ma nad kartą osobny blok Premium (DashboardUnlockBox) —
   *  wtedy bez drugiej, drobnej linijki „Premium od 49 zł/mies.”. */
  hidePremiumLine?: boolean;
}) {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const [diagnoses, setDiagnoses] = useState<DiagnosisRow[] | null>(null);
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  // Diagnoza v2 w toku (rozpoczęta, nieukończona) — „Kontynuuj diagnozę”.
  const [diagCur, setDiagCur] = useState<{
    completed: boolean;
    answeredCount: number;
    questionCount: number;
  } | null>(null);
  // Wybór przedmiotu (i poziomu) przed odebraniem — jak /darmowy-arkusz na webie.
  const [picker, setPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api<{ diagnoses: DiagnosisRow[] }>("/diagnosis/mine")
        .then((d) => !cancelled && setDiagnoses(d?.diagnoses ?? []))
        .catch(() => !cancelled && setDiagnoses([]));
      getTrialStatus()
        .then((t) => !cancelled && setTrial(t))
        .catch(() => {});
      api<{ current: any }>("/diagnosis/v2/current")
        .then((d) => !cancelled && setDiagCur(d?.current ?? null))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (diagnoses === null) return null;

  const goExams = () =>
    navigation.getParent()?.navigate("ExamTab", { screen: "ExamSelector" });

  // Claim odbity FREE_PACK_USED_NETWORK — wiersz pokaże komunikat z Premium.
  const markFreePackBlocked = () =>
    setTrial((t) => (t ? { ...t, eligible: false, active: false, freePackBlocked: true } : t));

  // ── Diagnoza: jedno zdanie + jeden przycisk ──────────────────────────────
  const diag = diagnoses[0];
  const diagInProgress = !diag && diagCur && !diagCur.completed;
  const diagText = diag
    ? // Bez „najsłabszego działu" — przy 13 pytaniach to zwykle jedno pytanie.
      `Twój wynik: ${diag.scorePercent ?? 0}%.`
    : diagInProgress
      ? `Zaczęty: rozwiązane ${diagCur!.answeredCount} z ${diagCur!.questionCount}.`
      : "13 zadań z wybranego przedmiotu, każde od razu ocenione.";
  const diagCta = diag
    ? "Zobacz wynik →"
    : diagInProgress
      ? "Kontynuuj quiz →"
      : "Rozwiąż quiz →";
  const onDiag = () =>
    navigation.navigate("Diagnosis", diag ? { token: diag.token } : undefined);

  // ── Darmowy arkusz ───────────────────────────────────────────────────────
  // Teksty przycisków = web (components/free-sheet/FreeSheetState.astro).
  // Konto z przypiętym arkuszem widzi WYŁĄCZNIE jego stan — bez wyboru
  // przedmiotu, bo arkusz jest jeden na konto.
  const examDone =
    trial?.attemptStatus === "COMPLETED" || trial?.attemptStatus === "GRADING";
  let examText: string;
  let examCta: string | null = null;
  let onExam: (() => void) | null = null;
  if (examDone && trial?.examAttemptId) {
    examText = trial.canContinue
      ? `Oddany. Zadań do zrobienia: ${trial.remainingTasks ?? 0}.`
      : "Oddany. Wynik zostaje na stałe.";
    examCta = "Zobacz swój arkusz →";
    onExam = () => openFreeSheet(navigation, trial!);
  } else if (trial?.examId) {
    examText = "Otwarty i czeka na Ciebie — bez limitu czasu, odpowiedzi zapisują się same.";
    examCta = "Kontynuuj arkusz →";
    // Prosto do arkusza, nie do listy (jak na webie).
    onExam = () =>
      navigation.getParent()?.navigate("ExamTab", {
        screen: "ExamPlay",
        params: { examId: trial!.examId!, subjectId: "" },
      });
  } else if (trial?.active) {
    examText = "Oferta odebrana — wybierz przedmiot, kiedy chcesz, a arkusz otworzy się od razu.";
    examCta = "Rozwiąż arkusz →";
    onExam = () => setPicker(true);
  } else if (isFreePackBlocked(trial)) {
    // Pakiet startowy poszedł już z tej sieci/urządzenia — zamiast
    // „Odbierz darmowy arkusz" prowadzimy do Premium.
    examText = FREE_PACK_BLOCKED_MESSAGE;
    examCta = FS_CTA_UNAVAILABLE;
    onExam = onPremium;
  } else if (trial?.eligible) {
    examText = "Zobacz, jak wygląda rozwiązywanie arkuszy w aplikacji.";
    examCta = "Rozwiąż arkusz →";
    onExam = () => setPicker(true);
  } else if (trial) {
    // Odebrana oferta zostaje aktywna bez terminu, więc tu trafia już tylko
    // konto, któremu darmowy arkusz nie przysługuje.
    examText = FS_MSG_NOT_ELIGIBLE;
    examCta = FS_CTA_UNAVAILABLE;
    onExam = onPremium;
  } else {
    examText = "Zobacz, jak wygląda rozwiązywanie arkuszy w aplikacji.";
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

      {row("📊", "Quiz", diagText, diagCta, onDiag)}
      <View
        style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }}
      />
      {row("📝", "Arkusz", examText, examCta, onExam)}
      <FreeSheetPicker
        visible={picker}
        onClose={() => setPicker(false)}
        trial={trial}
        trigger="dashboard"
        onFreePackBlocked={markFreePackBlocked}
      />

      {!hidePremiumLine && (
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
      )}
    </View>
  );
}
