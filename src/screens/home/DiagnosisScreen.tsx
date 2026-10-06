// ============================================================================
// DiagnosisScreen — darmowa diagnoza NATYWNIE w apce
// src/screens/home/DiagnosisScreen.tsx
//
// Od 26.09.2026 diagnoza v2 (jak na webie): 13 zadań (angielski 18) różnego typu, każde
// oceniane od razu (zadania otwarte — AI), tylko dla zalogowanych, jedna na
// konto. Ten ekran robi wybór przedmiotu, wznowienie i raport; samo
// rozwiązywanie gra na ekranie Quizu (trasa DiagnosisPlay, QuizPlayScreen
// z parametrem `diagnosis`) — te same renderery, etykiety i blok oceny AI.
//
//   /diagnosis/v2/current → rozpoczęta/ukończona diagnoza konta (wznowienie)
//   /diagnosis/v2/subjects → przedmioty z gotową pulą
//   /diagnosis/v2/start    → token + pytania (409 = już jest → wracamy do niej)
//   /diagnosis/v2/state    → pytania + zapisane odpowiedzi (wznowienie)
//   /diagnosis/result      → raport (v2: pytania z odpowiedzią i oceną)
//
// Stare podejścia v1 (4 typy zamknięte, sprzed 1.0.28) nadal otwierają raport.
// Ramy wyniku dobiera BACKEND (passThreshold/examKind). Ten sam plik żyje
// w apkach matury / zdaj-angielski / ósmoklasisty — nic markowego.
// ============================================================================

import React, { useCallback, useEffect, useState } from "react";
import { freeQuizCount } from "../../lib/freeQuiz";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { api, ApiError } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { TestimonialPrompt } from "../../components/feedback/TestimonialPrompt";
import { TYPE_LABELS } from "../quiz/QuizPlayScreen";
import { difficultyLabel, difficultyColor } from "../../lib/difficulty";
import { FreePackText } from "../../components/common/FreePackText";
import { useAuth } from "../../context/AuthContext";
import { daysToMatura } from "../../components/common/PremiumGate";
import { colors } from "../../theme/colors";
import { hasPassThreshold, PASS_PERCENT } from "../../utils/passThreshold";

/** Wynik matury, od którego zaczyna się liczyć w rekrutacji (jak w wynikach arkusza). */
const RECRUIT_PERCENT = 65;
import { radius, spacing } from "../../theme";
import { parseChemText } from "../../utils/chemText";
import { subjectGenitive as subjectGenitiveOf } from "../../lib/subjectGenitive";

interface DiagSubject {
  slug: string;
  name: string;
  icon: string;
  color: string;
  /** Liczba pytań quizu (angielski 18, reszta 13); starszy backend jej nie zwraca. */
  questionCount?: number;
}

interface TopicRow {
  topicId: string;
  topicName: string;
  earned: number;
  total: number;
  /** „Pokaż odpowiedź” w tym dziale (backend od 6.10.2026; starsze wyniki bez pola). */
  revealed?: number;
}

interface ResultQuestion {
  id: string;
  type: string;
  topicName: string;
  content: any;
  yourAnswer: any;
  score: number;
  isCorrect: boolean;
  // v1
  correctAnswer?: any;
  explanation?: string | null;
  // v2
  difficulty?: number;
  answered?: boolean;
  feedback?: any;
}

interface FullResult {
  version?: number;
  subject: { slug: string; name: string };
  scorePercent: number;
  /** null = egzamin bez progu zdawalności (ósmoklasista). */
  passed: boolean | null;
  passThreshold: number | null;
  examKind?: "OSMOKLASISTA" | "MATURA" | "FCE" | "CAE";
  topicBreakdown: TopicRow[];
  questions: ResultQuestion[];
  /** Zadania oceniane przez AI, których nie oceniono, bo darmowy pakiet
   *  (z oceną AI w diagnozie) poszedł już z tej sieci/urządzenia. */
  aiLockedCount?: number;
  freePackBlocked?: boolean;
  freePackMessage?: string;
}

type Phase =
  | { kind: "pick"; subjects: DiagSubject[] | null; error?: string }
  | { kind: "loading"; label: string }
  | { kind: "result"; result: FullResult; token: string }
  | { kind: "error"; message: string };

/** „1 zadanie”, „3 zadania”, „5 zadań”. */
const lockedLabel = (n: number) =>
  n === 1
    ? "1 zadanie"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? `${n} zadania`
      : `${n} zadań`;

/** „Język polski — egzamin ósmoklasisty” → „Język polski”. */
const shortName = (name: string, _slug?: string) =>
  name.split(" — ")[0].split(" (")[0].trim();

function subjectGenitive(slug: string, fallbackName: string): string {
  return subjectGenitiveOf(slug, fallbackName.toLowerCase());
}

/** Punkty rekrutacyjne z wyniku diagnozy E8 — te same mnożniki co na webie. */
function recruitPoints(scorePercent: number, slug: string): { pts: string; max: number } {
  const mult = /angiel|niemiec|jezyk|język/i.test(slug) ? 0.3 : 0.35;
  const pts = Math.round(scorePercent * mult * 10) / 10;
  return { pts: String(pts).replace(".", ","), max: Math.round(mult * 100) };
}

function formatYourAnswer(q: ResultQuestion): string {
  const opts: { id: string; text: string }[] = q.content?.options ?? [];
  const textOf = (id: any) => opts.find((o) => o.id === String(id))?.text ?? String(id);
  const a = q.yourAnswer;
  if (a == null) return "— brak odpowiedzi —";
  switch (q.type) {
    case "CLOSED":
      return textOf(a);
    case "MULTI_SELECT":
      return Array.isArray(a) && a.length ? a.map(textOf).join(", ") : "— brak —";
    case "TRUE_FALSE":
      return Array.isArray(a) ? a.map((v) => (v ? "P" : "F")).join(", ") : "— brak —";
    case "MATCHING":
      return typeof a === "object"
        ? Object.entries(a)
            .map(([l, r]) => `${l} → ${r}`)
            .join("; ")
        : "— brak —";
    default:
      return String(a);
  }
}

function formatCorrect(q: ResultQuestion): string {
  const c = q.correctAnswer;
  if (c == null) return "";
  switch (q.type) {
    case "CLOSED":
      return String(c);
    case "MULTI_SELECT":
      return (c as string[]).join(", ");
    case "TRUE_FALSE":
      return (c as { text: string; isTrue: boolean }[])
        .map((s) => `${s.isTrue ? "P" : "F"} — ${s.text}`)
        .join("\n");
    case "MATCHING":
      return (c as { left: string; right: string }[])
        .map((p) => `${p.left} → ${p.right}`)
        .join("\n");
    default:
      return "";
  }
}

/** Koło wyniku jak web: zielone nad progiem/celem, czerwone pod progiem,
 *  żółte pod celem 65% (przedmiot bez progu). */
function ScoreRing({
  percent,
  sub,
  color,
  theme,
}: {
  percent: number;
  sub?: string;
  color: string;
  theme: any;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 150, height: 150, alignSelf: "center", marginBottom: 12 }}>
      <Svg width={150} height={150} viewBox="0 0 120 120" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" stroke={theme.border} />
        <Circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * c} ${c}`}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 34, fontWeight: "800", color: theme.text }}>{percent}%</Text>
        {sub ? <Text style={{ fontSize: 11, color: theme.textSecondary }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/** inline: ekran osadzony w zakładce Quiz (konto FREE, od 5.10.2026) — quiz
 *  otwiera się nad nim (navigate), zamiast podmieniać korzeń zakładki. */
export function DiagnosisScreen({ inline = false }: { inline?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const goPlay = (params: any) =>
    inline ? navigation.navigate("DiagnosisPlay", params) : navigation.replace("DiagnosisPlay", params);
  const route = useRoute<any>();
  const params = (route.params ?? {}) as {
    subjectSlug?: string;
    token?: string;
    view?: "report";
  };

  const [phase, setPhase] = useState<Phase>({ kind: "loading", label: "Ładuję…" });
  const [openQ, setOpenQ] = useState<string | null>(null);
  const { isPremium } = useAuth();

  // Przegląd ukończonego quizu: ekran Quizu w trybie „po ocenie”, z tą samą
  // nawigacją co przy rozwiązywaniu — Twoja odpowiedź, ocena, klucz
  // i wyjaśnienie przy każdym pytaniu. Wynik (raport) jest osobną zakładką,
  // do której prowadzi przycisk „Wynik” w nagłówku (Karol 2.10.2026).
  // replace, nie navigate: przełączanie przegląd ↔ wynik nie rośnie stosu.
  const review = useCallback(
    (r: FullResult, token: string, index: number) => {
      const answered: Record<string, { response: any; feedback: any }> = {};
      for (const q of r.questions) {
        // Bez odpowiedzi (nie „Pokaż odpowiedź”): pytanie zostaje do
        // rozwiązania, jak przy pierwszym podejściu; backend przyjmuje
        // odpowiedź także po zakończeniu i przelicza wynik (Karol 2.10.2026).
        const revealed = (q as any).revealed === true || q.feedback?.revealed === true;
        if (q.answered === false && !revealed) continue;
        answered[q.id] = {
          response: q.yourAnswer,
          feedback: q.answered === false ? { ...q.feedback, revealed: true } : q.feedback,
        };
      }
      goPlay({
        sessionId: "",
        subjectId: "",
        subjectName: r.subject.name,
        questions: r.questions,
        diagnosis: { token, mode: "review", answered, startIndex: index },
      });
    },
    [navigation],
  );

  // ── Raport ──────────────────────────────────────────────────────────────────
  // openReview: ukończony quiz v2 otwiera się w przeglądzie pytań, a nie
  // od razu w raporcie (stary v1 nie ma danych do przeglądu — tylko raport).
  const loadResult = useCallback(async (token: string, openReview = false) => {
    setPhase({ kind: "loading", label: openReview ? "Wczytuję quiz…" : "Ładuję wynik…" });
    try {
      const result = await api<FullResult>(`/diagnosis/result/${encodeURIComponent(token)}`);
      if (openReview && result.version === 2 && result.questions?.length) {
        review(result, token, 0);
        return;
      }
      setOpenQ(null);
      setPhase({ kind: "result", result, token });
    } catch (e) {
      setPhase({
        kind: "error",
        message:
          e instanceof ApiError && e.status === 403
            ? "To podejście jest przypisane do innego konta."
            : "Nie udało się pobrać wyniku. Spróbuj ponownie za chwilę.",
      });
    }
  }, [review]);

  // ── Rozwiązywanie na ekranie Quizu (nowa albo wznowiona diagnoza) ─────────
  const openPlay = useCallback(
    async (token: string) => {
      setPhase({ kind: "loading", label: "Wczytuję quiz…" });
      try {
        const st = await api<any>(`/diagnosis/v2/state/${encodeURIComponent(token)}`);
        if (st.completed) {
          await loadResult(token);
          return;
        }
        goPlay({
          sessionId: "",
          subjectId: "",
          subjectName: st.subject?.name ?? "",
          questions: st.questions,
          diagnosis: { token, mode: "play", answered: st.answered ?? {} },
        });
      } catch {
        setPhase({ kind: "error", message: "Nie udało się wczytać quizu. Spróbuj ponownie." });
      }
    },
    [loadResult, navigation],
  );

  // ── Wybór przedmiotu ────────────────────────────────────────────────────────
  const loadSubjects = useCallback(async () => {
    setPhase({ kind: "pick", subjects: null });
    try {
      const d = await api<{ subjects: DiagSubject[] }>("/diagnosis/v2/subjects", { auth: false });
      setPhase({ kind: "pick", subjects: d?.subjects ?? [] });
    } catch {
      setPhase({
        kind: "pick",
        subjects: [],
        error: "Nie udało się pobrać listy przedmiotów. Sprawdź połączenie.",
      });
    }
  }, []);

  useEffect(() => {
    if (params.token) {
      void loadResult(params.token, params.view !== "report");
      return;
    }
    // Diagnoza jest jedna na konto: rozpoczęta → wracamy do niej, ukończona →
    // raport, stara (v1) ukończona → jej raport.
    (async () => {
      try {
        const cur = await api<{ current: { token: string; completed: boolean } | null }>(
          "/diagnosis/v2/current",
        );
        if (cur?.current) {
          if (cur.current.completed) await loadResult(cur.current.token, true);
          else await openPlay(cur.current.token);
          return;
        }
        const mine = await api<{ diagnoses: { token: string }[] }>("/diagnosis/mine");
        const t = mine?.diagnoses?.[0]?.token;
        if (t) {
          await loadResult(t);
          return;
        }
      } catch {}
      await loadSubjects();
    })();
  }, [params.token, params.view, loadResult, loadSubjects, openPlay]);

  const start = async (subject: DiagSubject) => {
    setPhase({ kind: "loading", label: "Losuję zadania…" });
    try {
      const d = await api<any>("/diagnosis/v2/start", {
        method: "POST",
        body: { subject: subject.slug },
      });
      goPlay({
        sessionId: "",
        subjectId: "",
        subjectName: d.subject?.name ?? subject.name,
        questions: d.questions,
        diagnosis: { token: d.token, mode: "play", answered: {} },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.token) {
        const t = e.data.token as string;
        if (e.data.code === "DIAGNOSIS_IN_PROGRESS") await openPlay(t);
        else await loadResult(t, true);
        return;
      }
      setPhase({
        kind: "error",
        message:
          e instanceof ApiError && e.status === 429
            ? "Limit podejść na dziś wykorzystany — spróbuj jutro."
            : e instanceof ApiError
              ? e.message
              : "Nie udało się rozpocząć quizu.",
      });
    }
  };

  const back = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.getParent()?.navigate("HomeTab", { screen: "Dashboard" });
  };

  const container = {
    flex: 1,
    backgroundColor: theme.background,
  } as const;
  const content = {
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 40,
    paddingHorizontal: spacing[5],
  } as const;

  const Header = ({ title }: { title: string }) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
      <TouchableOpacity onPress={back} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={theme.text} />
        <Text style={{ fontSize: 15, fontWeight: "500", color: theme.text }}>Wróć</Text>
      </TouchableOpacity>
      <Text
        numberOfLines={1}
        style={{ flex: 1, textAlign: "right", fontSize: 13, color: theme.textSecondary }}
      >
        {title}
      </Text>
    </View>
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (phase.kind === "loading") {
    return (
      <View style={[container, { alignItems: "center", justifyContent: "center", gap: 12 }]}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
        <Text style={{ color: theme.textSecondary }}>{phase.label}</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (phase.kind === "error") {
    return (
      <ScrollView style={container} contentContainerStyle={content}>
        <Header title="Darmowy quiz" />
        <Card>
          <Text style={{ fontSize: 15, color: colors.red[500], marginBottom: 14 }}>{phase.message}</Text>
          <Button title="Wróć do wyboru przedmiotu" onPress={() => void loadSubjects()} size="sm" />
        </Card>
      </ScrollView>
    );
  }

  // ── Wybór przedmiotu ────────────────────────────────────────────────────────
  if (phase.kind === "pick") {
    return (
      <ScrollView style={container} contentContainerStyle={content}>
        <Header title="Darmowy quiz" />
        <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text, marginBottom: 6 }}>
          Darmowy quiz: zobacz, jak wygląda nauka w apce
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 18 }}>
          Tak wygląda nauka w apce: kilkanaście zadań różnego typu z wybranego przedmiotu,
          jak w Quizie — z oceną i wyjaśnieniem po każdym, także przy
          zadaniach otwartych. Możesz przerwać i wrócić. Jeden darmowy quiz na konto.
        </Text>
        {phase.subjects === null ? (
          <ActivityIndicator color={colors.brand[500]} />
        ) : phase.subjects.length === 0 ? (
          <Card>
            <Text style={{ color: theme.textSecondary }}>
              {phase.error ?? "Quiz pojawi się wkrótce."}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {phase.subjects.map((s) => {
              const preselected = params.subjectSlug === s.slug;
              return (
                <TouchableOpacity
                  key={s.slug}
                  onPress={() => void start(s)}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    padding: 16,
                    borderRadius: radius["2xl"],
                    borderWidth: 2,
                    borderColor: preselected ? colors.brand[500] : theme.cardBorder,
                    backgroundColor: theme.card,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{s.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
                      {shortName(s.name, s.slug)}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                      {s.questionCount ?? freeQuizCount(s.slug)} zadań · ok. 15 minut
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Wynik ───────────────────────────────────────────────────────────────────
  // Układ i kolejność jak web DiagnosisResult.tsx (Karol 28.09.2026):
  // „✓ Twoja diagnoza jest gotowa” → koło z wynikiem (próg albo „cel: 65%
  // (rekrutacja)”) → nagłówek → brak oceny AI → box Premium → „Pytania
  // i odpowiedzi” → „Twoje działy — od najsłabszego” → „Najwięcej tracisz
  // tutaj” → prośba o opinię. Bez karty darmowego arkusza (web 26.09: ma
  // miejsce w panelu „Za darmo”) i bez reklamy apki (jesteśmy w apce).
  if (phase.kind === "result") {
    const r = phase.result;
    const isV2 = r.version === 2;
    const isE8 = r.examKind === "OSMOKLASISTA";
    // Próg zdawalności ma tylko matura PP z przedmiotu obowiązkowego
    // (utils/passThreshold.ts; backend wysyła wtedy passThreshold: 30).
    // Starszy backend dawał 30 przy każdym przedmiocie maturalnym — dlatego
    // sprawdzamy też slug (web: diagnosisHasPassThreshold).
    const withThreshold =
      r.passThreshold !== null &&
      r.passThreshold !== undefined &&
      (r.examKind !== "MATURA" && r.examKind !== undefined
        ? true
        : hasPassThreshold(r.subject.slug, "PODSTAWOWY"));
    const threshold = r.passThreshold ?? PASS_PERCENT;
    const aboveTarget = withThreshold
      ? r.scorePercent >= threshold
      : r.scorePercent >= RECRUIT_PERCENT;
    const ringColor = aboveTarget ? "#22c55e" : withThreshold ? "#ef4444" : "#f59e0b";
    // Ósmoklasista: bez progu, ale z punktami rekrutacyjnymi (jak dotąd).
    const rp = !withThreshold && isE8 ? recruitPoints(r.scorePercent, r.subject.slug) : null;
    const ringSub = withThreshold
      ? `próg: ${threshold}%`
      : rp
        ? `${rp.pts} pkt z ${rp.max}`
        : `cel: ${RECRUIT_PERCENT}% (rekrutacja)`;
    const quizCount = r.questions?.length || freeQuizCount(r.subject?.slug);
    const headline = `Wynik z ${quizCount} zadań: ${r.scorePercent}%`;

    // Działy od najsłabszego — jak web (topicBreakdown z backendu).
    const rows = [...(r.topicBreakdown ?? [])]
      .filter((t) => t && t.total > 0)
      .sort((a, b) => a.earned / a.total - b.earned / b.total);
    // Odsłonięte odpowiedzi liczą się jako 0 pkt, ale pokazujemy je osobno —
    // kto tylko odsłaniał, widział „najwięcej punktów uciekło” we wszystkich
    // działach jak po samych błędach (Karol 6.10.2026). Starszy wynik nie ma
    // pola w dziale — liczymy wtedy z pytań.
    const isRevealed = (q: any) => q?.revealed === true || q?.feedback?.revealed === true;
    const revealedIn = (t: TopicRow) =>
      typeof t.revealed === "number"
        ? t.revealed
        : (r.questions ?? []).filter((q: any) => isRevealed(q) && q.topicName === t.topicName).length;
    const revealedCount = (r.questions ?? []).filter(isRevealed).length;
    const mostlyRevealed = revealedCount > 0 && revealedCount * 2 >= quizCount;
    const weak = rows.filter((t) => t.earned / t.total < 0.5 && revealedIn(t) < t.total);
    const lockedN = Number(r.aiLockedCount) || 0;
    const days = r.examKind === "MATURA" || r.examKind === undefined ? daysToMatura() : null;
    const toSubscription = () =>
      navigation.getParent()?.navigate("ProfileTab", { screen: "Subscription" });

    return (
      <ScrollView style={container} contentContainerStyle={content}>
        <Header title={`Darmowy quiz · ${shortName(r.subject.name, r.subject.slug)}`} />

        {/* Zakładka „Wynik” jest częścią quizu: powrót do pytań z ocenami. */}
        {isV2 && r.questions?.length > 0 && (
          <TouchableOpacity
            onPress={() => review(r, phase.token, 0)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.brand[500] + "66",
              backgroundColor: colors.brand[500] + (isDark ? "1F" : "12"),
              marginBottom: 18,
            }}
          >
            <Ionicons name="arrow-back" size={16} color={colors.brand[500]} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.brand[500] }}>
              Wróć do pytań quizu
            </Text>
          </TouchableOpacity>
        )}

        {/* Dokańczanie: pytania bez odpowiedzi da się jeszcze rozwiązać. */}
        {isV2 &&
          (() => {
            const open = (r.questions ?? [])
              .map((q: any, i: number) =>
                q.answered === false && !(q.revealed === true || q.feedback?.revealed === true) ? i : -1,
              )
              .filter((i: number) => i >= 0);
            if (!open.length) return null;
            const n = open.length;
            const word = n === 1 ? "zadanie" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "zadania" : "zadań";
            return (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.brand[500] + "55",
                  backgroundColor: colors.brand[500] + (isDark ? "1A" : "10"),
                  marginBottom: 18,
                }}
              >
                <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20, marginBottom: 10 }}>
                  Masz {n} {word} bez odpowiedzi. Rozwiąż je, a wynik przeliczy się od razu.
                </Text>
                <Button
                  title={`Dokończ nierozwiązane zadania (${n}) →`}
                  onPress={() => review(r, phase.token, open[0])}
                  size="sm"
                />
              </View>
            );
          })()}

        {/* Nagłówek z wynikiem — najpierw „gotowe”, potem liczba (web). */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: isDark ? "#064e3b55" : "#ecfdf5",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.6,
                color: isDark ? "#6ee7b7" : "#047857",
              }}
            >
              ✓ TWÓJ WYNIK JEST GOTOWY
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: "center",
              lineHeight: 19,
              marginBottom: 14,
            }}
          >
            Darmowy quiz · {shortName(r.subject.name, r.subject.slug)} . Poniżej wynik,
            Twoje odpowiedzi z wyjaśnieniami i co dalej.
          </Text>
          <ScoreRing percent={r.scorePercent} sub={ringSub} color={ringColor} theme={theme} />
          <Text
            style={{
              fontSize: 21,
              fontWeight: "800",
              color: theme.text,
              textAlign: "center",
              lineHeight: 27,
            }}
          >
            {headline}
          </Text>
          {revealedCount > 0 && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: "#d97706",
                textAlign: "center",
                lineHeight: 19,
                marginTop: 8,
              }}
            >
              Odsłonięte odpowiedzi: {revealedCount} z {quizCount} — liczą się jako 0 pkt.
            </Text>
          )}
          {(
            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                textAlign: "center",
                lineHeight: 19,
                marginTop: 8,
              }}
            >
              {mostlyRevealed
                ? "Najpierw spróbuj sam — wtedy wynik pokaże, co naprawdę umiesz."
                : "To próbka nauki, nie prognoza wyniku egzaminu. Pełny obraz da arkusz egzaminacyjny."}
            </Text>
          )}
        </View>

        {/* Konto bez darmowego pakietu: część zadań bez oceny AI (web:
            FreePackBlockedNote). Starszy backend nie wysyła pola — wtedy nic. */}
        {(lockedN > 0 || r.freePackBlocked === true) && (
          <Card style={{ marginBottom: 16, borderColor: "#f59e0b" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>
              {lockedN > 0 ? `Bez oceny AI: ${lockedLabel(lockedN)}` : "Bez oceny AI"}
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>
              {lockedN === 1
                ? "1 odpowiedzi nie oceniliśmy automatycznie i nie liczymy jej do wyniku. "
                : lockedN > 1
                  ? `${lockedN} odpowiedzi nie oceniliśmy automatycznie i nie liczymy ich do wyniku. `
                  : ""}
              <FreePackText message={r.freePackMessage} />
            </Text>
          </Card>
        )}

        {/* Premium pod wynikiem, nad pytaniami (web UnlockQuizBox) — tylko
            konto bez Premium. Zakup idzie przez Google Play (Subscription). */}
        {!isPremium && (
          <View
            style={{
              marginBottom: 20,
              padding: 18,
              borderRadius: radius["2xl"],
              borderWidth: 1,
              borderColor: isDark ? colors.brand[700] + "99" : colors.brand[300],
              backgroundColor: isDark ? colors.brand[900] + "4D" : colors.brand[50],
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.8,
                color: isDark ? colors.brand[300] : colors.brand[700],
                marginBottom: 4,
              }}
            >
              PREMIUM
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: theme.text,
                lineHeight: 24,
                marginBottom: 10,
              }}
            >
              Odblokuj nielimitowane quizy z {subjectGenitive(r.subject.slug, shortName(r.subject.name))} i
              innych przedmiotów
            </Text>
            <View style={{ gap: 6, marginBottom: 14 }}>
              {[
                "Cały bank zadań z wyborem działu, typu zadań i poziomu trudności",
                "Wyjaśnienie po każdej odpowiedzi i pytania tam, gdzie tracisz punkty",
                isE8
                  ? "Wszystkie przedmioty i arkusze egzaminacyjne"
                  : "Wszystkie przedmioty maturalne i arkusze egzaminacyjne",
              ].map((b) => (
                <View key={b} style={{ flexDirection: "row", gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: isDark ? colors.brand[400] : colors.brand[600],
                    }}
                  >
                    ✓
                  </Text>
                  <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 19 }}>{b}</Text>
                </View>
              ))}
            </View>
            <Button title="Odblokuj Premium →" onPress={toSubscription} size="sm" />
          </View>
        )}

        {/* Pytania i odpowiedzi — pod boxem Premium, nad działami (web). */}
        <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text, marginBottom: 10 }}>
          Pytania i odpowiedzi
        </Text>
        <View style={{ gap: 8, marginBottom: 24 }}>
          {r.questions.map((q, i) => {
            const open = openQ === q.id;
            const skipped = q.answered === false;
            // Zadanie AI bez oceny (darmowy pakiet wykorzystany) — nie „✗".
            const locked = !skipped && q.feedback?.aiLocked === true;
            const revealed = (q as any).revealed === true || q.feedback?.revealed === true;
            const badge = skipped || locked
              ? theme.textTertiary
              : q.isCorrect
                ? colors.brand[500]
                : q.score > 0
                  ? "#f59e0b"
                  : colors.red[500];
            // Treść pytania bywa w różnych polach zależnie od typu.
            const c = q.content ?? {};
            const title = String(
              c.question || c.instruction || c.prompt || c.text || c.sentence || c.context || TYPE_LABELS[q.type] || "",
            );
            return (
              <View
                key={q.id}
                style={{
                  borderRadius: radius["2xl"],
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.card,
                  overflow: "hidden",
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    // v2: przegląd na ekranie Quizu (odpowiedź, klucz, komentarz AI)
                    isV2 ? review(r, phase.token, i) : setOpenQ(open ? null : q.id)
                  }
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: badge,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                      {skipped ? "–" : locked ? "?" : q.isCorrect ? "✓" : q.score > 0 ? "½" : "✗"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ fontSize: 13, color: theme.text }}>
                      {i + 1}. {parseChemText(title)}
                    </Text>
                    {isV2 && (
                      <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3 }}>
                        {TYPE_LABELS[q.type] || q.type}
                        {q.difficulty ? " · " : ""}
                        {q.difficulty ? (
                          <Text style={{ color: difficultyColor(q.difficulty), fontWeight: "700" }}>
                            {difficultyLabel(q.difficulty)}
                          </Text>
                        ) : null}
                        {skipped
                          ? " · bez odpowiedzi"
                          : locked
                            ? " · bez oceny AI"
                            : revealed
                              ? " · pokazana odpowiedź"
                              : ""}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={isV2 ? "chevron-forward" : open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.textTertiary}
                  />
                </TouchableOpacity>
                {open && !isV2 && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                    <View style={{ padding: 10, borderRadius: radius.xl, backgroundColor: theme.inputBg }}>
                      <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 2 }}>Twoja odpowiedź</Text>
                      <Text style={{ fontSize: 13, color: theme.text }}>{parseChemText(formatYourAnswer(q))}</Text>
                    </View>
                    <View style={{ padding: 10, borderRadius: radius.xl, backgroundColor: colors.brand[500] + "14" }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: isDark ? colors.brand[400] : colors.brand[600],
                          fontWeight: "700",
                          marginBottom: 2,
                        }}
                      >
                        Poprawna odpowiedź
                      </Text>
                      <Text style={{ fontSize: 13, color: theme.text }}>{parseChemText(formatCorrect(q))}</Text>
                    </View>
                    {q.explanation ? (
                      <View style={{ padding: 10, borderRadius: radius.xl, backgroundColor: theme.inputBg }}>
                        <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "700", marginBottom: 2 }}>
                          Wyjaśnienie
                        </Text>
                        <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
                          {parseChemText(q.explanation)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Rozbicie na działy — od najsłabszego, kolory jak web
            (< 40% czerwony, < 70% żółty, reszta zielony). */}
        {rows.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text, marginBottom: 14 }}>
              Wynik po działach w tych {quizCount} zadaniach
            </Text>
            <View style={{ gap: 12 }}>
              {rows.map((t) => {
                const pct = Math.round((t.earned / t.total) * 100);
                const barColor = pct < 40 ? colors.red[500] : pct < 70 ? "#f59e0b" : colors.brand[500];
                return (
                  <View key={t.topicId || t.topicName}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                        marginBottom: 5,
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 18 }}>
                        {t.topicName}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: theme.textSecondary,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {revealedIn(t) > 0 ? (
                          <Text style={{ color: "#d97706" }}>odsłonięte: {revealedIn(t)}  </Text>
                        ) : null}
                        {pct}%
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: isDark ? "rgba(255,255,255,0.09)" : colors.surface[100],
                      }}
                    >
                      <View
                        style={{
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: barColor,
                          width: `${Math.max(pct, 4)}%`,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Domknięcie wyniku: gdzie tracisz, ile dni do matury, jedno wyjście
            (web: ciemny box „Najwięcej tracisz tutaj”). */}
        <View
          style={{
            marginBottom: 16,
            padding: 18,
            borderRadius: radius["2xl"],
            backgroundColor: isDark ? colors.navy[900] : colors.navy[800],
            borderWidth: isDark ? 1 : 0,
            borderColor: colors.navy[700] + "66",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff", marginBottom: 6 }}>
            {weak.length > 0
              ? "W tych zadaniach najwięcej punktów uciekło tutaj"
              : mostlyRevealed
                ? "Najpierw spróbuj sam"
                : "Dobry start. Teraz przełóż go na wynik"}
          </Text>
          <Text style={{ fontSize: 14, color: colors.navy[100], lineHeight: 21, marginBottom: 12 }}>
            {weak.length > 0 ? (
              <>
                <Text style={{ fontWeight: "800", color: "#fff" }}>
                  {weak
                    .slice(0, 3)
                    .map((t) => t.topicName)
                    .join(", ")}
                </Text>
                {isE8
                  ? ". W Premium ćwiczysz pytania z tych działów, pełne arkusze na czas i ocenę zadań otwartych według kryteriów CKE."
                  : ". W Premium ćwiczysz pytania z tych działów, pełne arkusze maturalne na czas i ocenę wypracowań według kryteriów CKE."}
              </>
            ) : mostlyRevealed ? (
              "Odsłonięte odpowiedzi nie pokazują, co umiesz. W Premium rozwiązujesz pytania z każdego działu, a po każdej odpowiedzi od razu widzisz ocenę i wyjaśnienie."
            ) : (
              `${quizCount} zadań to tylko próbka. O wyniku egzaminu decydują zadania otwarte i wypracowania — te odblokowujesz w Premium, razem z pełnymi arkuszami na czas.`
            )}
          </Text>
          {days !== null && days > 0 && (
            <Text style={{ fontSize: 13, color: colors.navy[200], lineHeight: 19, marginBottom: 14 }}>
              ⏳ Do matury zostało <Text style={{ fontWeight: "800", color: "#fff" }}>{days} dni</Text>. Im
              wcześniej zaczniesz regularną naukę, tym mniej pod górkę.
            </Text>
          )}
          {!isPremium && (
            <Button
              title={weak.length > 0 ? "Ćwicz te działy w Premium →" : "Odblokuj pełne arkusze →"}
              onPress={toSubscription}
              size="sm"
            />
          )}
        </View>

        {/* Prośba o ocenę tylko przy dobrym wyniku (≥ 60%), jak na webie —
            obok słabego wyniku i paywalla nikt nie oceniał (Karol 28.09.2026). */}
        {(r.scorePercent ?? 0) >= 60 && (
          <TestimonialPrompt
            trigger="diagnosis"
            context={{ percentage: r.scorePercent, subject: r.subject.slug }}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Bez „Powtórz diagnozę": serwer pozwala na jedną diagnozę na osobę,
            więc link robił pętlę do tego samego wyniku (25.09.2026). */}
      </ScrollView>
    );
  }

  return null;
}
