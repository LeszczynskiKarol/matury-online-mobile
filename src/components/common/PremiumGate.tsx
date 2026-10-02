// ============================================================================
// PremiumGate — konwersyjny ekran blokady (port webowego PremiumGate)
// src/components/common/PremiumGate.tsx
//
// Zamiast generycznego "🔒 wymaga Premium": per-trybowe copy z konkretami,
// countdown do matury, mini-podgląd wartości (arkusz; w słuchaniu prawdziwe nagranie),
// personalizacja z darmowej diagnozy (/api/diagnosis/mine) i risk-reversal.
// CTA prowadzi do SubscriptionScreen (Stripe checkout w in-app browser).
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../ui/Button";
import { api } from "../../api/client";
import { logIntent } from "../../api/premium";
import { TrialOfferCard } from "./TrialOfferCard";
import { AudioPlayer } from "../quiz/ListeningQuestion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";

type GateMode = "quiz" | "exam" | "listening";

// Pierwszy dzień matur (polski PP) — jak w webowym utils/maturaYear.
// CKE trzyma się pierwszego tygodnia maja; aktualizacja raz w roku wystarcza.
const MATURA_STARTS: Record<number, string> = {
  2026: "2026-05-04T09:00:00",
  2027: "2027-05-04T09:00:00",
  2028: "2028-05-04T09:00:00",
};

export function daysToMatura(): number | null {
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
  // Słuchanie — backend zamyka /listening/start i /next (requireAiCredits);
  // bez bramki user trafiał w pusty ekran „To było ostatnie zadanie", a stamtąd
  // „Od nowa" ładowało nagrania z banku z pominięciem blokady.
  listening: {
    headline: "Nagrania do słuchania, które się nie kończą",
    // Jak web PremiumGate „listening”, bez „tempo jak na CKE” (tego nie
    // mierzymy) i bez „1:1” przy typach zadań.
    bullets: [
      "Najpierw nagrania, których jeszcze nie słyszałeś — gdy zostaje ich mało, dogrywamy nowe w tle",
      "Różne głosy (🇬🇧/🇺🇸/🇦🇺), Hochdeutsch dla niemieckiego",
      "Typy zadań jak w arkuszu maturalnym",
    ],
    personalizedVerb:
      "Słuchanie to najszybsze punkty na maturze językowej — nie oddawaj ich.",
  },
  exam: {
    headline: "Przećwicz maturę, zanim zdasz ją naprawdę",
    bullets: [
      "Pełne arkusze z timerem — identyczny rygor jak na sali CKE",
      "Punktacja wg klucza i omówienie zadań otwartych",
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
  // Uczeń z polecenia korepetytora (miejsce ≠ Premium) — inne copy bramki.
  tutor?: { hasTutor: boolean; tutorName: string | null };
}

type GateVariant =
  | { kind: "default" }
  | { kind: "referred"; tutorName: string | null }
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
  // Zadania od korepetytora już ma — paywall sprzedaje RESZTĘ, nie „dostęp".
  if (st.tutor?.hasTutor) return { kind: "referred", tutorName: st.tutor.tutorName ?? null };
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
  if (v.kind === "referred") {
    const who = v.tutorName ? `od ${v.tutorName}` : "od korepetytora";
    return {
      headline: `Zadania ${who} już masz. Chcesz ćwiczyć też między lekcjami?`,
      bullets: [
        `Zadania ${who} rozwiązujesz bez ograniczeń — to masz w ramach miejsca`,
        "Premium dokłada cały bank pytań, arkusze z timerem, ocenę wypracowań i słuchanie — na własną rękę",
        maturaBullet(days),
      ],
      cta: "Odblokuj resztę Matury Online",
    };
  }
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
      // Bez odsyłania do darmowej diagnozy — to oferta dla nowych kont, a tu
      // stoi ktoś, kto już płacił i produkt zna (decyzja Karola 17.09.2026).
      "System dobierze pytania od nowa pod Twoje aktualne braki",
      maturaBullet(days),
    ],
    cta: "Wznów Premium",
  };
}

// ── Mini-podglądy wartości ───────────────────────────────────────────────────

interface ListeningSample {
  audioUrl: string;
  audioDurationMs: number;
  instruction: string | null;
  subQuestion: {
    text: string;
    options: { id: string; text: string }[];
    correctAnswer: string;
  };
  subQuestionCount: number;
}

function pytaniaDoNagrania(n: number): string {
  if (n === 1) return "jest do niego 1 pytanie";
  const lastTwo = n % 100;
  const last = n % 10;
  const few = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14);
  return few ? `są do niego ${n} pytania` : `jest do niego ${n} pytań`;
}

// Prawdziwe nagranie z bazy — jak web ListeningPreview: /public/listening-sample
// (zawsze to samo, jedno pytanie z kluczem), odtwarzacz ten sam co w Słuchaniu.
function ListeningPreview() {
  const { colors: theme } = useTheme();
  const [sample, setSample] = useState<ListeningSample | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<ListeningSample>("/public/listening-sample", { auth: false })
      .then((d) => (d?.audioUrl && d?.subQuestion ? setSample(d) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!sample) {
    return (
      <View
        style={{
          height: 160,
          borderRadius: radius.xl,
          backgroundColor: theme.backgroundSecondary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.brand[500]} />
      </View>
    );
  }

  const sq = sample.subQuestion;
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
      {sample.instruction ? (
        <Text
          style={{ fontSize: 13, fontWeight: "600", color: theme.text, marginBottom: 10, lineHeight: 18 }}
        >
          {sample.instruction}
        </Text>
      ) : null}
      <AudioPlayer
        src={sample.audioUrl}
        maxPlays={Number.POSITIVE_INFINITY}
        durationMs={sample.audioDurationMs}
        disabled={false}
      />
      <View
        style={{
          marginTop: 12,
          padding: spacing[3],
          borderRadius: radius.lg,
          backgroundColor: theme.card,
        }}
      >
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#3b82f6",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 1,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>1</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: theme.text, lineHeight: 19 }}>
            {sq.text}
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          {sq.options.map((o) => {
            const ok = o.id === sq.correctAnswer;
            return (
              <View
                key={o.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: ok ? colors.brand[500] : "transparent",
                  backgroundColor: ok ? colors.brand[500] + "18" : "transparent",
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    backgroundColor: theme.backgroundSecondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: theme.text }}>{o.id}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: theme.text }}>{o.text}</Text>
                {ok && (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.brand[500] }}>
                    ✓ Poprawna
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
      <Text style={{ marginTop: 10, fontSize: 12, color: theme.textSecondary, lineHeight: 17 }}>
        Prawdziwe nagranie z aplikacji — w sesji {pytaniaDoNagrania(sample.subQuestionCount)}.
        Najpierw dostajesz nagrania, których jeszcze nie słyszałeś, a nowe dogrywamy w tle.
      </Text>
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
          0–50 pkt · próg 30%
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
  const insets = useSafeAreaInsets();
  const days = daysToMatura();
  const [diagnosis, setDiagnosis] = useState<DiagnosisSummary | null>(null);
  const [variant, setVariant] = useState<GateVariant>({ kind: "default" });

  useEffect(() => {
    // To samo wywołanie co w SubscriptionScreen — status z backendu decyduje,
    // czy pokazać copy „po wygaśnięciu"/„płatność nie przeszła".
    api<StripeStatus>("/stripe/status")
      .then((st) => {
        setVariant(classifyStatus(st));
      })
      .catch(() => {});

    // Log odbicia od paywalla — ta sama tabela co na webie, więc lejek w
    // panelu admina obejmuje oba klienty (tryb ma prefiks `mobile:`).
    logIntent("GATE_VIEW", mode);

    api<{ diagnoses: DiagnosisSummary[] }>("/diagnosis/mine")
      .then((d) => {
        const worst = [...(d?.diagnoses ?? [])]
          .filter((x) => typeof x.scorePercent === "number")
          // Pod słuchaniem tylko diagnoza z języka — „masz 24% z matematyki”
          // brzmi tu jak błąd, nie personalizacja (jak web subjectFilter).
          .filter((x) => mode !== "listening" || /angielski|niemiecki/.test(x.subjectSlug))
          .sort((a, b) => a.scorePercent! - b.scorePercent!)[0];
        if (worst) setDiagnosis(worst);
      })
      .catch(() => {});
  }, []);

  const special = variant.kind === "default" ? null : variantCopy(variant, days);
  const headline = special?.headline ?? cfg.headline;
  const bullets = special?.bullets ?? cfg.bullets;
  // Cena w osobnej linii pod przyciskiem, jak web („Od 49 zł miesięcznie”) —
  // w jednym tytule „— 49 zł/mies.” łamało się na 360 dp.
  const ctaTitle = special?.cta ?? "Przejdź na Premium";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: spacing[5],
        // Bramka jest pierwszym ekranem zakładki — bez wcięcia karta
        // wchodziła pod pasek statusu.
        paddingTop: insets.top + spacing[4],
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

        {mode !== "quiz" && (
          <View style={{ marginBottom: 16 }}>
            {mode === "listening" ? <ListeningPreview /> : <ExamPreview />}
          </View>
        )}

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
              📊 W darmowym quizie z przedmiotu{" "}
              <Text style={{ fontWeight: "700" }}>
                {diagnosis.subjectName.toLowerCase()}
              </Text>{" "}
              masz{" "}
              <Text style={{ fontWeight: "700" }}>{diagnosis.scorePercent}%</Text>
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
        {!special && (
          <Text
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Od <Text style={{ fontWeight: "700", color: theme.text }}>49 zł</Text> miesięcznie
          </Text>
        )}
        {variant.kind === "referred" && (
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate("HomeTab", { screen: "TutorAssignments" })}
            style={{ marginTop: 14, alignItems: "center" }}
          >
            <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "600" }}>
              ← Wróć do zadań od korepetytora
            </Text>
          </TouchableOpacity>
        )}
        {/* Subtelna podpowiedź o Pakiecie Maturalnym — najbardziej opłacalna
            opcja; prowadzi do ekranu Subskrypcja, gdzie pakiet stoi na górze. */}
        {/* Pod przyciskiem nic więcej: bez podpowiedzi o Pakiecie i bez
            „Anuluj w każdej chwili…" — decyzja Karola 25.09.2026. */}

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
