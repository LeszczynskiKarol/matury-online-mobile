// ============================================================================
// PremiumGate — konwersyjny ekran blokady (port webowego PremiumGate)
// src/components/common/PremiumGate.tsx
//
// Zamiast generycznego "🔒 wymaga Premium": per-trybowe copy z konkretami,
// countdown do matury, mini-podgląd wartości (w quizie interaktywny),
// personalizacja z darmowej diagnozy (/api/diagnosis/mine) i risk-reversal.
// CTA prowadzi do SubscriptionScreen (Stripe checkout w in-app browser).
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../ui/Button";
import { api } from "../../api/client";
import { logIntent } from "../../api/premium";
import { TrialOfferCard } from "./TrialOfferCard";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";

type GateMode = "quiz" | "exam";

// Pierwszy dzień matur (polski PP) — jak w webowym utils/maturaYear.
// CKE trzyma się pierwszego tygodnia maja; aktualizacja raz w roku wystarcza.
const MATURA_STARTS: Record<number, string> = {
  2026: "2026-05-04T09:00:00",
  2027: "2027-05-04T09:00:00",
  2028: "2028-05-04T09:00:00",
};

function daysToMatura(): number | null {
  const now = Date.now();
  for (const year of Object.keys(MATURA_STARTS).map(Number).sort()) {
    const t = new Date(MATURA_STARTS[year]).getTime();
    if (t > now) return Math.max(0, Math.ceil((t - now) / 86_400_000));
  }
  return null;
}

interface DiagnosisSummary {
  subjectSlug: string;
  subjectName: string;
  scorePercent: number | null;
  worstTopicName: string | null;
}

const MODE_CONFIG: Record<
  GateMode,
  { headline: string; bullets: string[]; personalizedVerb: string }
> = {
  quiz: {
    headline: "Trenuj na pytaniach, które naprawdę robią wynik",
    bullets: [
      "Tysiące pytań maturalnych ze wszystkich działów — z wyjaśnieniami",
      "System sam dobiera pytania pod Twoje braki i trudność",
      "Powtórki, streaki i XP — nauka, która wciąga",
    ],
    personalizedVerb: "Ten tryb dobierze Ci pytania dokładnie z tego działu.",
  },
  exam: {
    headline: "Przećwicz maturę, zanim zdasz ją naprawdę",
    bullets: [
      "Pełne arkusze z timerem — identyczny rygor jak na sali CKE",
      "Punktacja wg klucza + feedback AI do zadań otwartych",
      "Historia podejść: widzisz, jak rośnie Twój wynik",
    ],
    personalizedVerb:
      "Arkusz pokaże, ile ten dział kosztuje Cię punktów w warunkach egzaminu.",
  },
};

// ── Mini-podglądy wartości ───────────────────────────────────────────────────

function MiniQuizPreview() {
  const { colors: theme } = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  const options = [
    { id: "A", text: "x = 2", ok: false },
    { id: "B", text: "x = 3", ok: true },
    { id: "C", text: "x = 6", ok: false },
  ];
  return (
    <View
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.border,
        padding: spacing[4],
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: theme.textTertiary,
          marginBottom: 6,
        }}
      >
        SPRÓBUJ — TAK WYGLĄDA PYTANIE:
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: theme.text,
          marginBottom: 10,
        }}
      >
        Rozwiązaniem równania 2x − 1 = 5 jest:
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((o) => {
          const showState = picked !== null;
          const bg = !showState
            ? "transparent"
            : o.ok
              ? colors.brand[500] + "22"
              : picked === o.id
                ? colors.red[500] + "22"
                : "transparent";
          const border = !showState
            ? theme.border
            : o.ok
              ? colors.brand[500]
              : picked === o.id
                ? colors.red[500]
                : theme.border;
          return (
            <TouchableOpacity
              key={o.id}
              onPress={() => setPicked(o.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: bg,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>
                {o.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {picked && (
        <Text
          style={{
            fontSize: 12,
            color: theme.textSecondary,
            marginTop: 10,
            lineHeight: 17,
          }}
        >
          {picked === "B" ? "✅ Dokładnie tak!" : "❌ Poprawnie: x = 3."} 2x = 6,
          więc x = 3. Każde pytanie ma takie wyjaśnienie — a w Premium dodatkowo
          tłumaczenie AI krok po kroku.
        </Text>
      )}
    </View>
  );
}

function ExamPreview() {
  const { colors: theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.border,
        padding: spacing[4],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: theme.text }}>
          Matura próbna · podstawa
        </Text>
        <View
          style={{
            backgroundColor: colors.red[500] + "22",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: radius.md,
          }}
        >
          <Text
            style={{ fontSize: 12, fontWeight: "700", color: colors.red[500] }}
          >
            ⏱ 02:49:32
          </Text>
        </View>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.border,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: "22%",
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.brand[500],
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
          Zadanie 7 z 32
        </Text>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
          0–46 pkt · próg 30%
        </Text>
      </View>
    </View>
  );
}

// ── Główny komponent ─────────────────────────────────────────────────────────

export function PremiumGate({ mode }: { mode: GateMode }) {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const cfg = MODE_CONFIG[mode];
  const days = daysToMatura();
  const [diagnosis, setDiagnosis] = useState<DiagnosisSummary | null>(null);

  useEffect(() => {
    // Log odbicia od paywalla — ta sama tabela co na webie, więc lejek w
    // panelu admina obejmuje oba klienty (tryb ma prefiks `mobile:`).
    logIntent("GATE_VIEW", mode);

    api<{ diagnoses: DiagnosisSummary[] }>("/diagnosis/mine")
      .then((d) => {
        const worst = [...(d?.diagnoses ?? [])]
          .filter((x) => typeof x.scorePercent === "number")
          .sort((a, b) => a.scorePercent! - b.scorePercent!)[0];
        if (worst) setDiagnosis(worst);
      })
      .catch(() => {});
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: spacing[5],
        paddingBottom: 100,
      }}
    >
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: radius["2xl"],
          borderWidth: 2,
          borderColor: colors.brand[500] + "55",
          padding: spacing[5],
        }}
      >
        {days !== null && (
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                backgroundColor: colors.red[500] + "18",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
              }}
            >
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: colors.red[500] }}
              >
                ⏳ Do matury {days === 1 ? "został 1 dzień" : `zostało ${days} dni`}
              </Text>
            </View>
          </View>
        )}

        <Text
          style={{
            fontSize: 20,
            fontWeight: "800",
            color: theme.text,
            textAlign: "center",
            marginBottom: 14,
            lineHeight: 27,
          }}
        >
          {cfg.headline}
        </Text>

        <View style={{ gap: 8, marginBottom: 16 }}>
          {cfg.bullets.map((b) => (
            <View key={b} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={{ color: colors.brand[500], fontWeight: "700" }}>✓</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: theme.textSecondary,
                  lineHeight: 19,
                }}
              >
                {b}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ marginBottom: 16 }}>
          {mode === "quiz" ? <MiniQuizPreview /> : <ExamPreview />}
        </View>

        {diagnosis && diagnosis.scorePercent !== null && (
          <View
            style={{
              backgroundColor: colors.navy[500] + "18",
              borderRadius: radius.xl,
              padding: spacing[3],
              marginBottom: 16,
            }}
          >
            <Text
              style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}
            >
              📊 W diagnozie z przedmiotu{" "}
              <Text style={{ fontWeight: "700" }}>
                {diagnosis.subjectName.toLowerCase()}
              </Text>{" "}
              masz{" "}
              <Text style={{ fontWeight: "700" }}>{diagnosis.scorePercent}%</Text>
              {diagnosis.worstTopicName ? (
                <>
                  {" "}— najsłabszy dział:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {diagnosis.worstTopicName}
                  </Text>
                </>
              ) : null}
              . {cfg.personalizedVerb}
            </Text>
          </View>
        )}

        <Button
          title="Przejdź na Premium"
          onPress={() => {
            logIntent("GATE_CLICK", mode);
            navigation.getParent()?.navigate("ProfileTab", {
              screen: "Subscription",
            });
          }}
          icon={<Ionicons name="diamond" size={16} color="#fff" />}
        />
        <Text
          style={{
            fontSize: 11,
            color: theme.textTertiary,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          Anuluj w każdej chwili · Bezpieczna płatność Stripe · Dostęp od razu
        </Text>

        {/* Oferta próbna POD ceną — kto jest gotów kupić, kupuje wyżej. */}
        <TrialOfferCard trigger={`gate:${mode}`} />
      </View>
    </ScrollView>
  );
}
