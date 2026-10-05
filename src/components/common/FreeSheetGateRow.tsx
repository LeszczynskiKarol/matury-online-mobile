// ============================================================================
// FreeSheetGateRow — jeden zwarty wiersz „Arkusz za darmo” w bramce Egzaminu
// src/components/common/FreeSheetGateRow.tsx
//
// Zakładka Egzamin to drugie źródło odbiorów darmowego arkusza (prod
// 02.10.2026: 49 z 264 odebrań, po landingu). Duża karta „Zanim zdecydujesz”
// zniknęła z bramek, ale kto wchodzi w Egzamin, chce arkusza — więc tu zostaje
// jeden wiersz w stylu karty „Za darmo” (FreePanel), z linkiem zamiast
// przycisku, żeby nie konkurował z wezwaniem do Premium pod spodem.
// Konto bez prawa do arkusza (pakiet z tej sieci, płaciło wcześniej) nie widzi nic.
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { getTrialStatus, isFreePackBlocked, type TrialStatus } from "../../api/premium";
import { FreeSheetPicker } from "./FreeSheetPicker";
import { openFreeSheet } from "../../lib/openFreeSheet";
import { colors } from "../../theme/colors";
import { radius } from "../../theme";

export function FreeSheetGateRow() {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    getTrialStatus()
      .then(setTrial)
      .catch(() => {});
  }, []);

  if (!trial) return null;

  const done = trial.attemptStatus === "COMPLETED" || trial.attemptStatus === "GRADING";
  let text: string;
  let cta: string;
  let onPress: () => void;
  if (done && trial.examAttemptId) {
    text = trial.canContinue
      ? `Oddany. Zadań do zrobienia: ${trial.remainingTasks ?? 0}.`
      : "Oddany. Wynik zostaje na stałe.";
    cta = "Zobacz swój arkusz →";
    onPress = () => openFreeSheet(navigation, trial);
  } else if (trial.examId) {
    text = "Otwarty i czeka na Ciebie, bez limitu czasu.";
    cta = "Kontynuuj arkusz →";
    onPress = () =>
      navigation.getParent()?.navigate("ExamTab", {
        screen: "ExamPlay",
        params: { examId: trial.examId!, subjectId: "" },
      });
  } else if ((trial.active || trial.eligible) && !isFreePackBlocked(trial)) {
    text = "Jeden pełny arkusz na konto, bez karty.";
    cta = "Rozwiąż arkusz →";
    onPress = () => setPicker(true);
  } else {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <FreeSheetPicker
        visible={picker}
        onClose={() => setPicker(false)}
        trial={trial}
        trigger="gate:exam"
        onFreePackBlocked={(message) =>
          setTrial((s) =>
            s
              ? { ...s, eligible: false, active: false, freePackBlocked: true, freePackMessage: message || s.freePackMessage }
              : s,
          )
        }
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 22 }}>📝</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>Arkusz za darmo</Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 1 }}>{text}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onPress} accessibilityRole="button" style={{ marginTop: 10, paddingVertical: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.brand[500] }}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}
