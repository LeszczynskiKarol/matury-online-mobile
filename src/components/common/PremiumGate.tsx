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

// ── Wariant po wygaśnięciu / nieudanej płatności ─────────────────────────────
// Ta sama logika co w webowym PremiumGate: PAST_DUE → payment_failed;
// EXPIRED / CANCELLED|ONE_TIME|ANNUAL po subscriptionEnd → expired.
// Reszta (FREE, brak statusu) → dotychczasowy gate.

interface StripeStatus {
  subscriptionStatus?: string | null;
  subscriptionEnd?: string | null;
  hasPaidAccess?: boolean;
  provider?: "play" | "stripe";
  /** Tylko provider=play — np. SUBSCRIPTION_STATE_ON_HOLD. */
  playState?: string | null;
  annualOffer?: { play?: { available?: boolean } };
}

type GateVariant =
  | { kind: "default" }
  | { kind: "payment_failed" }
  | { kind: "play_hold" }
  | { kind: "expired"; daysSince: number | null };

function classifyStatus(st: StripeStatus | null): GateVariant {
  if (!st) return { kind: "default" };
  const status = (st.subscriptionStatus ?? "").toUpperCase();
  const now = Date.now();
  const endMs = st.subscriptionEnd ? new Date(st.subscriptionEnd).getTime() : NaN;
  const ended = Number.isFinite(endMs) && endMs < now;

  // Google Play wstrzymał subskrypcję po nieudanej płatności — backend
  // oznacza to jako EXPIRED, ale „wygasło" byłoby nieprawdą: wystarczy
  // zaktualizować płatność w Sklepie Play.
  if (st.provider === "play" && st.playState === "SUBSCRIPTION_STATE_ON_HOLD") {
    return { kind: "play_hold" };
  }
  if (status === "PAST_DUE") return { kind: "payment_failed" };
  if (
    status === "EXPIRED" ||
    ((status === "CANCELLED" || status === "ONE_TIME" || status === "ANNUAL") &&
      ended)
  ) {
    const daysSince = Number.isFinite(endMs)
      ? Math.floor((now - endMs) / 86_400_000)
      : null;
    return { kind: "expired", daysSince };
  }
  return { kind: "default" };
}

function pluralDni(n: number): string {
  return n === 1 ? "1 dzień" : `${n} dni`;
}

function maturaBullet(days: number | null, tail = ""): string {
  if (days === null) return `Do matury coraz bliżej${tail}`;
  return `Do matury ${days === 1 ? "został" : "zostało"} ${pluralDni(days)}${tail}`;
}

function variantCopy(
  v: Exclude<GateVariant, { kind: "default" }>,
  days: number | null,
): { headline: string; bullets: string[]; cta: string } {
  if (v.kind === "play_hold") {
    return {
      headline: "Google Play nie pobrał płatności za Premium",
      bullets: [
        "Subskrypcja jest wstrzymana, ale postępy, streak i powtórki czekają nietknięte",
        "Zaktualizuj metodę płatności w Sklepie Play — dostęp wróci automatycznie",
        "Nie kupuj Premium drugi raz — to założyłoby drugą subskrypcję",
      ],
      cta: "Napraw płatność w Sklepie Play",
    };
  }
  if (v.kind === "payment_failed") {
    return {
      // Bez „opłać / zmień kartę" (apka z Google Play nie może kierować do
      // płatności poza Play). Zakup w apce przez Play — backend anuluje wtedy
      // nieopłaconą subskrypcję Stripe (services/stripe-replace.ts).
      headline: "Płatność za Premium nie przeszła",
      bullets: [
        "Dostęp Premium jest wstrzymany, ale postępy, streak i powtórki czekają nietknięte",
        "Kup Premium w aplikacji przez Google Play — poprzednia, nieopłacona subskrypcja zostanie anulowana automatycznie",
      ],
      cta: "Kup Premium w Google Play",
    };
  }
  const d = v.daysSince;
  if (d !== null && d <= 30) {
    const when = d === 0 ? "dzisiaj" : d === 1 ? "wczoraj" : `${pluralDni(d)} temu`;
    return {
      headline: `Twoje Premium wygasło ${when}`,
      bullets: [
        "Wszystko zostało: XP, streak, historia sesji i powtórki",
        "Wznowienie to jedno kliknięcie — bez zakładania konta od nowa",
        maturaBullet(days, " — każdy tydzień przerwy to punkty do odrobienia"),
      ],
      cta: "Wznów Premium",
    };
  }
  if (d !== null && d <= 90) {
    return {
      headline: `Minęło ${pluralDni(d)} od wygaśnięcia Premium`,
      bullets: [
        "Twoje statystyki i powtórki są zachowane, ale plan nauki zdążył się rozjechać",
        "System dobierze pytania od nowa pod Twoje aktualne braki",
        maturaBullet(days),
      ],
      cta: "Wróć do nauki",
    };
  }
  return {
    headline: "Wróć do nauki przed maturą",
    bullets: [
      "Twoje konto i postępy nadal tu są",
      "Zacznij od darmowej diagnozy albo od razu od pytań z najsłabszych działów",
      maturaBullet(days),
    ],
    cta: "Wznów Premium",
  };
}

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
  const [variant, setVariant] = useState<GateVariant>({ kind: "default" });
  const [annualAvailable, setAnnualAvailable] = useState(false);

  useEffect(() => {
    // To samo wywołanie co w SubscriptionScreen — status z backendu decyduje,
    // czy pokazać copy „po wygaśnięciu"/„płatność nie przeszła".
    api<StripeStatus>("/stripe/status")
      .then((st) => {
        setVariant(classifyStatus(st));
        setAnnualAvailable(!!st?.annualOffer?.play?.available);
      })
      .catch(() => {});

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

  const special = variant.kind === "default" ? null : variantCopy(variant, days);
  const headline = special?.headline ?? cfg.headline;
  const bullets = special?.bullets ?? cfg.bullets;
  const ctaTitle = special?.cta ?? "Przejdź na Premium";

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
          {headline}
        </Text>

        <View style={{ gap: 8, marginBottom: 16 }}>
          {bullets.map((b) => (
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
          title={ctaTitle}
          onPress={() => {
            logIntent("GATE_CLICK", mode);
            navigation.getParent()?.navigate("ProfileTab", {
              screen: "Subscription",
            });
          }}
          icon={<Ionicons name="diamond" size={16} color="#fff" />}
        />
        {/* Subtelna podpowiedź o Pakiecie Maturalnym — najbardziej opłacalna
            opcja; prowadzi do ekranu Subskrypcja, gdzie pakiet stoi na górze. */}
        {annualAvailable && variant.kind !== "play_hold" && (
          <TouchableOpacity
            onPress={() => {
              logIntent("GATE_CLICK", `${mode}:annual`);
              navigation.getParent()?.navigate("ProfileTab", { screen: "Subscription" });
            }}
            style={{ marginTop: 12, alignItems: "center" }}
          >
            <Text style={{ fontSize: 12, color: colors.brand[500], fontWeight: "600", textAlign: "center" }}>
              💡 Pakiet Maturalny do 31 maja — ostatnie 30 dni gratis
            </Text>
          </TouchableOpacity>
        )}
        {variant.kind !== "play_hold" && (
        <Text
          style={{
            fontSize: 11,
            color: theme.textTertiary,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          Anuluj w każdej chwili · Płatność przez Google Play · Dostęp od razu
        </Text>
        )}

        {/* Oferta próbna POD ceną — kto jest gotów kupić, kupuje wyżej.
            Konto po wygaśnięciu / z nieudaną płatnością już zna produkt —
            tam oferta próbna nie ma sensu. */}
        {variant.kind === "default" && (
          <TrialOfferCard trigger={`gate:${mode}`} />
        )}
      </View>
    </ScrollView>
  );
}
