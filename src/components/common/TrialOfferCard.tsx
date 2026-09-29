// ============================================================================
// TrialOfferCard — oferta wartościowa zamiast rabatu (port z webu)
// src/components/common/TrialOfferCard.tsx
//
// „1 pełny arkusz + kredyty AI, za darmo, na 48h" pokazywane w momencie
// INTENCJI (odbicie od paywalla), nie po n-tym logowaniu.
//
// Bez obniżki ceny: rabat zakotwiczyłby cennik w dół na stałe i nauczył
// czekania na promocję. Oddanie kawałka produktu odpowiada na pytanie, czy
// blokadą jest cena, czy niezrozumienie wartości.
//
// Komponent sam decyduje, czy się wyrenderować (null gdy user płaci albo ma
// ofertę za sobą), więc można go wstawiać bez warunków.
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import {
  getTrialStatus,
  isFreePackBlocked,
  FREE_PACK_BLOCKED_MESSAGE,
  type TrialStatus,
} from "../../api/premium";
import { FreeSheetPicker } from "./FreeSheetPicker";
import { FS_CTA_OPEN, FS_PICK_CTA } from "../../lib/freeSheet";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "chwilę";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours} godz. ${minutes} min`;
  return `${minutes} min`;
}

export function TrialOfferCard({
  trigger,
  placement = "below",
}: {
  trigger: string;
  /** Gdzie karta stoi względem bloku z ceną — decyduje, po której stronie
   *  idzie kreska oddzielająca. */
  placement?: "above" | "below";
}) {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const claiming = false;
  const error: string | null = null;
  // Wybór przedmiotu (i poziomu) przed odebraniem — jak /darmowy-arkusz na webie.
  const [picker, setPicker] = useState(false);
  // Odliczanie tykane lokalnie co minutę — countdown ma budować pilność,
  // a nie odpytywać serwer co sekundę.
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    getTrialStatus()
      .then((d) => {
        setStatus(d);
        setRemainingMs(d.remainingMs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!status?.active) return;
    const t = setInterval(
      () => setRemainingMs((ms) => Math.max(0, ms - 60_000)),
      60_000,
    );
    return () => clearInterval(t);
  }, [status?.active]);

  if (!status) return null;

  const goToExams = () =>
    navigation.getParent()?.navigate("ExamTab", { screen: "ExamSelector" });
  const goToPremium = () =>
    navigation.getParent()?.navigate("ProfileTab", { screen: "Subscription" });

  const shell =
    placement === "above"
      ? ({
          marginBottom: spacing[5],
          paddingBottom: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        } as const)
      : ({
          marginTop: spacing[5],
          paddingTop: spacing[4],
          borderTopWidth: 1,
          borderTopColor: theme.border,
        } as const);

  // ── Darmowy pakiet wykorzystany z tej sieci / urządzenia ──────────────
  // Konto nie jest blokowane — tylko bez oferty. Zamiast „Odbieram za darmo"
  // mówimy wprost, dlaczego, i prowadzimy do Premium.
  if (!status.active && isFreePackBlocked(status)) {
    return (
      <View style={shell}>
        <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>
          {FREE_PACK_BLOCKED_MESSAGE}
        </Text>
        <TouchableOpacity onPress={goToPremium} style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: colors.brand[500] }}>
            Zobacz Premium →
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!status.eligible && !status.active) return null;

  // ── Arkusz już oddany ─────────────────────────────────────────────────
  // Okno oferty (48 h) trwa dalej, ale oferta jest wykorzystana: karta mówiła
  // „Twój darmowy arkusz czeka — Wróć do arkusza" przy oddanym arkuszu
  // (zgłoszenie 25.09.2026). Wynik jest w karcie „Za darmo" na Starcie.
  if (
    status.attemptStatus === "COMPLETED" ||
    status.attemptStatus === "GRADING"
  )
    return null;

  const pickerEl = (
    <FreeSheetPicker
      visible={picker}
      onClose={() => setPicker(false)}
      trial={status}
      trigger={trigger}
      onFreePackBlocked={() =>
        setStatus((s) => (s ? { ...s, eligible: false, active: false, freePackBlocked: true } : s))
      }
    />
  );
  // Przypięty arkusz — prosto do niego (jak web), bez wyboru przedmiotu.
  const openSheet = () =>
    navigation.getParent()?.navigate("ExamTab", {
      screen: "ExamPlay",
      params: { examId: status.examId!, subjectId: "" },
    });

  // ── Oferta odebrana i wciąż ważna ──────────────────────────────────────
  if (status.active) {
    return (
      <View style={shell}>
        {pickerEl}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <View
            style={{
              backgroundColor: colors.brand[500],
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>
              AKTYWNE
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand[500] }}>
            zostało {formatRemaining(remainingMs)}
          </Text>
        </View>

        <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text, marginBottom: 4 }}>
          {status.examId
            ? "Twój darmowy arkusz czeka"
            : "Masz odblokowany 1 pełny arkusz"}
        </Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
          {status.examId
            ? "Wróć do niego, oddaj i zobacz ocenę AI do każdego zadania otwartego."
            : `Wybierz przedmiot i poziom — pełny arkusz bez limitu czasu, punktacja wg klucza i feedback AI. Do tego ${status.credits} kredytów AI.`}
        </Text>

        <TouchableOpacity
          onPress={status.examId ? openSheet : () => setPicker(true)}
          style={{
            backgroundColor: colors.brand[500],
            paddingVertical: 12,
            borderRadius: radius.xl,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
            {status.examId ? FS_CTA_OPEN : FS_PICK_CTA}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Oferta do odebrania ────────────────────────────────────────────────
  return (
    <View style={shell}>
      {pickerEl}
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color: colors.brand[500],
          marginBottom: 4,
        }}
      >
        ZANIM ZDECYDUJESZ
      </Text>
      <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text, marginBottom: 8 }}>
        Odbierz jeden pełny arkusz za darmo
      </Text>

      {[
        "1 pełny arkusz maturalny — bez limitu czasu, możesz na raty",
        "Punktacja wg klucza + feedback AI do zadań otwartych",
        `${status.credits} kredytów AI na ocenianie Twoich odpowiedzi`,
      ].map((b) => (
        <View key={b} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <Text style={{ color: colors.brand[500], fontWeight: "800" }}>✓</Text>
          <Text style={{ flex: 1, fontSize: 13, color: theme.textSecondary }}>{b}</Text>
        </View>
      ))}

      <TouchableOpacity
        onPress={() => setPicker(true)}
        disabled={claiming}
        style={{
          backgroundColor: colors.brand[500],
          opacity: claiming ? 0.6 : 1,
          paddingVertical: 13,
          borderRadius: radius.xl,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        {claiming ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
            {FS_PICK_CTA}
          </Text>
        )}
      </TouchableOpacity>

      <Text
        style={{
          fontSize: 11,
          color: theme.textTertiary,
          textAlign: "center",
          marginTop: 8,
        }}
      >
        Ważne {status.windowHours} godz. od odebrania · bez karty · jednorazowo
      </Text>

      {error && (
        <Text style={{ fontSize: 11, color: colors.red[500], marginTop: 6 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
