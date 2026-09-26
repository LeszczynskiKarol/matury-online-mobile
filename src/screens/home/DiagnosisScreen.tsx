// ============================================================================
// DiagnosisScreen — darmowa diagnoza NATYWNIE w apce
// src/screens/home/DiagnosisScreen.tsx
//
// Od 26.09.2026 diagnoza v2 (jak na webie): 13 zadań różnego typu, każde
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
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { api, ApiError } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { TYPE_LABELS } from "../quiz/QuizPlayScreen";
import { difficultyLabel, difficultyColor } from "../../lib/difficulty";
import { getTrialStatus, claimTrial, type TrialStatus } from "../../api/premium";
import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme";
import { parseChemText } from "../../utils/chemText";

interface DiagSubject {
  slug: string;
  name: string;
  icon: string;
  color: string;
}

interface TopicRow {
  topicId: string;
  topicName: string;
  earned: number;
  total: number;
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
}

type Phase =
  | { kind: "pick"; subjects: DiagSubject[] | null; error?: string }
  | { kind: "loading"; label: string }
  | { kind: "result"; result: FullResult; token: string }
  | { kind: "error"; message: string };

/** „Język polski — egzamin ósmoklasisty” → „Język polski”. */
const shortName = (name: string, _slug?: string) =>
  name.split(" — ")[0].split(" (")[0].trim();

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

function ScoreRing({ percent, sub, theme }: { percent: number; sub?: string; theme: any }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = percent >= 70 ? "#22c55e" : percent >= 45 ? "#f59e0b" : "#ef4444";
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

export function DiagnosisScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as { subjectSlug?: string; token?: string };

  const [phase, setPhase] = useState<Phase>({ kind: "loading", label: "Ładuję…" });
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  // ── Raport ──────────────────────────────────────────────────────────────────
  const loadResult = useCallback(async (token: string) => {
    setPhase({ kind: "loading", label: "Ładuję raport…" });
    try {
      const result = await api<FullResult>(`/diagnosis/result/${encodeURIComponent(token)}`);
      setOpenQ(null);
      setPhase({ kind: "result", result, token });
      getTrialStatus().then(setTrial).catch(() => {});
    } catch (e) {
      setPhase({
        kind: "error",
        message:
          e instanceof ApiError && e.status === 403
            ? "To podejście jest przypisane do innego konta."
            : "Nie udało się pobrać raportu. Spróbuj ponownie za chwilę.",
      });
    }
  }, []);

  // ── Rozwiązywanie na ekranie Quizu (nowa albo wznowiona diagnoza) ─────────
  const openPlay = useCallback(
    async (token: string) => {
      setPhase({ kind: "loading", label: "Wczytuję diagnozę…" });
      try {
        const st = await api<any>(`/diagnosis/v2/state/${encodeURIComponent(token)}`);
        if (st.completed) {
          await loadResult(token);
          return;
        }
        navigation.replace("DiagnosisPlay", {
          sessionId: "",
          subjectId: "",
          subjectName: st.subject?.name ?? "",
          questions: st.questions,
          diagnosis: { token, mode: "play", answered: st.answered ?? {} },
        });
      } catch {
        setPhase({ kind: "error", message: "Nie udało się wczytać diagnozy. Spróbuj ponownie." });
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
      void loadResult(params.token);
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
          if (cur.current.completed) await loadResult(cur.current.token);
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
  }, [params.token, loadResult, loadSubjects, openPlay]);

  const start = async (subject: DiagSubject) => {
    setPhase({ kind: "loading", label: "Losuję zadania…" });
    try {
      const d = await api<any>("/diagnosis/v2/start", {
        method: "POST",
        body: { subject: subject.slug },
      });
      navigation.replace("DiagnosisPlay", {
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
        else await loadResult(t);
        return;
      }
      setPhase({
        kind: "error",
        message:
          e instanceof ApiError && e.status === 429
            ? "Limit podejść na dziś wykorzystany — spróbuj jutro."
            : e instanceof ApiError
              ? e.message
              : "Nie udało się rozpocząć diagnozy.",
      });
    }
  };

  // Przegląd pytania z raportu: ekran Quizu w trybie „po ocenie” — Twoja
  // odpowiedź, klucz i komentarz AI dokładnie tak, jak przy rozwiązywaniu.
  const review = (r: FullResult, token: string, index: number) => {
    const answered: Record<string, { response: any; feedback: any }> = {};
    for (const q of r.questions) {
      answered[q.id] = {
        response: q.yourAnswer,
        // Bez odpowiedzi: pokazujemy klucz jak po „Pokaż odpowiedź”, bez „źle”.
        feedback: q.answered === false ? { ...q.feedback, revealed: true } : q.feedback,
      };
    }
    navigation.navigate("DiagnosisPlay", {
      sessionId: "",
      subjectId: "",
      subjectName: r.subject.name,
      questions: r.questions,
      diagnosis: { token, mode: "review", answered, startIndex: index },
    });
  };

  const claim = async () => {
    setClaiming(true);
    try {
      setTrial(await claimTrial("diagnosis"));
      navigation.getParent()?.navigate("ExamTab", { screen: "ExamSelector" });
    } catch (e: any) {
      Alert.alert("Nie udało się", e?.message || "Nie udało się odebrać arkusza.");
    } finally {
      setClaiming(false);
    }
  };

  const back = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Dashboard");
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
        <Header title="Diagnoza" />
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
        <Header title="Darmowa diagnoza" />
        <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text, marginBottom: 6 }}>
          Sprawdź za darmo swoją wiedzę i działanie apki
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 18 }}>
          Tak wygląda nauka w apce: 13 zadań różnego typu z wybranego przedmiotu,
          jak w Quizie — z oceną i wyjaśnieniem po każdym, a zadania otwarte
          ocenia AI. Możesz przerwać i wrócić. Jedna darmowa diagnoza na konto.
        </Text>
        {phase.subjects === null ? (
          <ActivityIndicator color={colors.brand[500]} />
        ) : phase.subjects.length === 0 ? (
          <Card>
            <Text style={{ color: theme.textSecondary }}>
              {phase.error ?? "Diagnoza pojawi się wkrótce."}
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
                      13 zadań · ok. 15 minut
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
  if (phase.kind === "result") {
    const r = phase.result;
    const isV2 = r.version === 2;
    // 13 pytań na kilkanaście działów = zwykle JEDNO pytanie na dział, więc
    // procent przy dziale mógł być tylko 0% albo 100% i nic nie mówił
    // (zgłoszenie 25.09.2026). Zamiast pasków: gdzie były błędy, a gdzie nie.
    const cleanTopic = (n: string) => n.replace(/^[IVXLC]+\.\s*/, "").trim();
    const byTopic = new Map<string, { wrong: number; partial: number; skipped: number; total: number }>();
    for (const q of r.questions ?? []) {
      const key = cleanTopic(q.topicName || "Inne");
      const t = byTopic.get(key) ?? { wrong: 0, partial: 0, skipped: 0, total: 0 };
      t.total += 1;
      if (q.answered === false) t.skipped += 1;
      else if (!q.isCorrect) {
        if (q.score > 0) t.partial += 1;
        else t.wrong += 1;
      }
      byTopic.set(key, t);
    }
    const weakTopics = [...byTopic.entries()]
      .filter(([, t]) => t.wrong + t.partial + t.skipped > 0)
      .sort((a, b) => b[1].wrong + b[1].partial - (a[1].wrong + a[1].partial) || b[1].skipped - a[1].skipped);
    const goodTopics = [...byTopic.entries()]
      .filter(([, t]) => t.wrong + t.partial + t.skipped === 0)
      .map(([name]) => name);
    const correctCount = (r.questions ?? []).filter((q) => q.isCorrect).length;
    const weak = weakTopics.map(([name]) => ({ topicName: name }));
    const mistakesLabel = (t: { wrong: number; partial: number; skipped: number }) => {
      const parts: string[] = [];
      if (t.wrong) parts.push(t.wrong === 1 ? "1 błąd" : t.wrong < 5 ? `${t.wrong} błędy` : `${t.wrong} błędów`);
      if (t.partial) parts.push(t.partial === 1 ? "1 częściowo" : `${t.partial} częściowo`);
      if (t.skipped) parts.push(t.skipped === 1 ? "1 bez odpowiedzi" : `${t.skipped} bez odpowiedzi`);
      return parts.join(" · ");
    };
    const hasThreshold = r.passThreshold !== null && r.passThreshold !== undefined;
    const rp = hasThreshold ? null : recruitPoints(r.scorePercent, r.subject.slug);
    const ringSub = hasThreshold
        ? r.passed
          ? `zdana (próg ${r.passThreshold}%)`
          : `poniżej progu ${r.passThreshold}%`
        : `${rp!.pts} pkt z ${rp!.max}`;
    const headline = hasThreshold
      ? r.passed
        ? r.scorePercent >= 70
          ? "Dobry wynik — czas dopracować szczegóły."
          : "Próg jest, teraz podnieś wynik."
        : "Poniżej progu — wiesz już, od czego zacząć."
      : r.scorePercent >= 70
        ? "Dobry wynik — czas dopracować szczegóły."
        : "Wiesz już, od czego zacząć.";
    return (
      <ScrollView style={container} contentContainerStyle={content}>
        <Header title={`Diagnoza · ${shortName(r.subject.name, r.subject.slug)}`} />
        <ScoreRing percent={r.scorePercent} sub={ringSub} theme={theme} />
        <Text
          style={{
            fontSize: 20,
            fontWeight: "800",
            color: theme.text,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          {headline}
        </Text>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
            Dobrze: {correctCount} z {r.questions?.length ?? 0} zadań
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, lineHeight: 17 }}>
            13 zadań to za mało, żeby oceniać każdy dział osobno — pokazujemy,
            gdzie pojawiły się błędy.
          </Text>

          {weakTopics.length > 0 && (
            <>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginTop: 16, marginBottom: 8 }}>
                Do powtórki
              </Text>
              <View style={{ gap: 8 }}>
                {weakTopics.map(([name, t]) => (
                  <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: t.wrong ? colors.red[500] : t.partial ? "#f59e0b" : theme.textTertiary,
                      }}
                    />
                    <Text style={{ flex: 1, fontSize: 14, color: theme.text }}>{name}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{mistakesLabel(t)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {goodTopics.length > 0 && (
            <>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginTop: 16, marginBottom: 8 }}>
                Poszło dobrze
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {goodTopics.map((name) => (
                  <View
                    key={name}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: "#10b98122",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#10b981" }}>✓ {name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Następny krok: darmowy arkusz (póki przysługuje), potem Premium. */}
        {trial &&
        trial.attemptStatus !== "COMPLETED" &&
        trial.attemptStatus !== "GRADING" &&
        (trial.eligible || trial.active || trial.examId) ? (
          <Card style={{ marginBottom: 16, backgroundColor: colors.brand[500] + "14", borderColor: colors.brand[500] }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: colors.brand[500], letterSpacing: 1, marginBottom: 4 }}>
              NASTĘPNY KROK · ZA DARMO
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 6 }}>
              {trial.examId ? "Dokończ swój darmowy arkusz" : "Sprawdź się na pełnym arkuszu"}
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 12 }}>
              {weak.length > 0
                ? `Diagnoza pokazała, gdzie tracisz (${weak
                    .slice(0, 2)
                    .map((t) => t.topicName)
                    .join(", ")}). Pełny arkusz powie, ile to kosztuje w punktach — `
                : "Diagnoza sprawdziła wybrane działy. Pełny arkusz pokaże wynik w punktach — "}
              z oceną AI zadań otwartych, bez limitu czasu.
            </Text>
            <Button
              title={
                trial.examId
                  ? "Kontynuuj arkusz →"
                  : trial.active
                    ? "Wybierz arkusz →"
                    : "Odbierz darmowy arkusz →"
              }
              loading={claiming}
              onPress={() => {
                if (trial.examId) {
                  navigation.getParent()?.navigate("ExamTab", {
                    screen: "ExamPlay",
                    params: { examId: trial.examId, subjectId: "" },
                  });
                } else if (trial.active) {
                  navigation.getParent()?.navigate("ExamTab", { screen: "ExamSelector" });
                } else void claim();
              }}
              size="sm"
            />
          </Card>
        ) : (
          <Card style={{ marginBottom: 16, backgroundColor: colors.brand[500] + "14", borderColor: colors.brand[500] }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 6 }}>
              {weak.length > 0 ? "Najwięcej tracisz tutaj" : "Solidna baza — teraz przełóż ją na wynik"}
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 12 }}>
              {weak.length > 0
                ? `${weak
                    .slice(0, 3)
                    .map((t) => t.topicName)
                    .join(", ")}. W Premium ćwiczysz te działy w Quizie bez limitu, rozwiązujesz pełne arkusze i dostajesz ocenę wypowiedzi pisemnych.`
                : "W Premium ćwiczysz w Quizie bez limitu, rozwiązujesz pełne arkusze na czas i dostajesz ocenę wypowiedzi pisemnych."}
            </Text>
            <Button
              title="Zobacz Premium →"
              onPress={() => navigation.getParent()?.navigate("ProfileTab", { screen: "Subscription" })}
              size="sm"
            />
          </Card>
        )}

        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 10 }}>
          Pytania i odpowiedzi
        </Text>
        <View style={{ gap: 8, marginBottom: 20 }}>
          {r.questions.map((q, i) => {
            const open = openQ === q.id;
            const skipped = q.answered === false;
            const badge = skipped
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
                      {skipped ? "–" : q.isCorrect ? "✓" : q.score > 0 ? "½" : "✗"}
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
                        {q.answered === false ? " · bez odpowiedzi" : ""}
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
                      <Text style={{ fontSize: 11, color: colors.brand[600], fontWeight: "700", marginBottom: 2 }}>
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

        {/* Bez „Powtórz diagnozę": serwer pozwala na jedną diagnozę na osobę,
            więc link robił pętlę do tego samego wyniku (25.09.2026). */}
      </ScrollView>
    );
  }

  return null;
}
