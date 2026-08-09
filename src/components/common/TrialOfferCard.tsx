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
import { getTrialStatus, claimTrial, type TrialStatus } from "../../api/premium";

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
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function onClaim() {
    setClaiming(true);
    setError(null);
    try {
      const d = await claimTrial(trigger);
      setStatus(d);
      setRemainingMs(d.remainingMs);
    } catch (e: any) {
      setError(e?.message || "Nie udało się odebrać oferty.");
    } finally {
      setClaiming(false);
    }
  }

  if (!status) return null;
  if (!status.eligible && !status.active) return null;

  const goToExams = () =>
    navigation.getParent()?.navigate("ExamTab", { screen: "ExamSelector" });

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

  // ── Oferta odebrana i wciąż ważna ──────────────────────────────────────
  if (status.active) {
    return (
      <View style={shell}>
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
            : `Wybierz przedmiot i poziom — arkusz z timerem, punktacja wg klucza i feedback AI. Do tego ${status.credits} kredytów AI.`}
        </Text>

        <TouchableOpacity
          onPress={goToExams}
          style={{
            backgroundColor: colors.brand[500],
            paddingVertical: 12,
            borderRadius: radius.xl,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
            {status.examId ? "Wróć do arkusza →" : "Wybierz arkusz →"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Oferta do odebrania ────────────────────────────────────────────────
  return (
    <View style={shell}>
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
        "1 pełny arkusz maturalny z timerem — jak na sali CKE",
        "Punktacja wg klucza + feedback AI do zadań otwartych",
        `${status.credits} kredytów AI na ocenianie Twoich odpowiedzi`,
      ].map((b) => (
        <View key={b} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <Text style={{ color: colors.brand[500], fontWeight: "800" }}>✓</Text>
          <Text style={{ flex: 1, fontSize: 13, color: theme.textSecondary }}>{b}</Text>
        </View>
      ))}

      <TouchableOpacity
        onPress={onClaim}
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
            Odbieram za darmo
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
