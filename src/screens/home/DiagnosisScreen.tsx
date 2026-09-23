// ============================================================================
// DiagnosisScreen — darmowa diagnoza NATYWNIE w apce
// src/screens/home/DiagnosisScreen.tsx
//
// Do 23.09.2026 kafel „Zrób diagnozę” na pulpicie otwierał przeglądarkę
// systemową z /diagnoza na webie — uczeń wypadał z apki, logował się drugi raz
// i wracał do niej ręcznie. Ten ekran robi to samo na tym samym backendzie
// (routes/diagnosis.ts), którego używa web:
//
//   /diagnosis/subjects → wybór przedmiotu z gotową pulą
//   /diagnosis/start    → 13 pytań zamkniętych (bez kluczy), token podejścia
//   /diagnosis/submit   → ocena po stronie serwera
//   /diagnosis/claim    → przypięcie podejścia do konta (w apce user JEST
//                         zalogowany, więc claim idzie od razu po ocenie)
//   /diagnosis/result   → pełny raport: działy, klucze, wyjaśnienia
//
// Odpowiedzi mają dokładnie kształt, którego oczekuje gradeOne() w backendzie:
// CLOSED = id opcji, MULTI_SELECT = id[], TRUE_FALSE = boolean[],
// MATCHING = { lewa: prawa }. Lustro webowego DiagnosisPlayer/DiagnosisResult.
//
// Ramy wyniku dobiera BACKEND (passThreshold/examKind): matura ma próg 30%
// i „zdana/niezdana”, egzamin ósmoklasisty progu nie ma — wynik przelicza się
// na punkty rekrutacyjne (język ×0,3; polski i matematyka ×0,35). Ten sam plik
// żyje w apkach matury / zdaj-angielski / ósmoklasisty — nie wpisywać tu
// niczego markowego.
// ============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { api, ApiError } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { OptionCard } from "../../components/quiz/OptionCard";
import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme";
import { parseChemText } from "../../utils/chemText";

type DiagType = "CLOSED" | "MULTI_SELECT" | "TRUE_FALSE" | "MATCHING";

interface DiagSubject {
  slug: string;
  name: string;
  icon: string;
  color: string;
}

interface DiagQuestion {
  id: string;
  type: DiagType;
  topicName: string;
  content: {
    question: string;
    imageUrl?: string;
    options?: { id: string; text: string }[];
    statements?: { text: string }[];
    left?: string[];
    right?: string[];
  };
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
  correctAnswer: any;
  explanation: string | null;
}

interface FullResult {
  subject: { slug: string; name: string };
  scorePercent: number;
  /** null = egzamin bez progu zdawalności (ósmoklasista). */
  passed: boolean | null;
  passThreshold: number | null;
  examKind?: "OSMOKLASISTA" | "MATURA";
  topicBreakdown: TopicRow[];
  questions: ResultQuestion[];
}

type Phase =
  | { kind: "pick"; subjects: DiagSubject[] | null; error?: string }
  | { kind: "loading"; label: string }
  | { kind: "playing"; subject: DiagSubject; token: string; questions: DiagQuestion[] }
  | { kind: "result"; result: FullResult }
  | { kind: "error"; message: string };

/** „Język polski — egzamin ósmoklasisty” → „Język polski”. */
const shortName = (name: string) => name.split(" — ")[0].split(" (")[0].trim();

/** Czy pytanie ma KOMPLETNĄ odpowiedź (T/F i dobieranie wymagają wszystkich pozycji). */
function isComplete(q: DiagQuestion, a: any): boolean {
  if (a === undefined) return false;
  switch (q.type) {
    case "TRUE_FALSE":
      return (
        Array.isArray(a) &&
        (q.content.statements ?? []).every((_s, i) => typeof a[i] === "boolean")
      );
    case "MATCHING":
      return (q.content.left ?? []).every((l) => !!a?.[l]);
    case "MULTI_SELECT":
      return Array.isArray(a) && a.length > 0;
    default:
      return true;
  }
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
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as { subjectSlug?: string; token?: string };

  const [phase, setPhase] = useState<Phase>({ kind: "loading", label: "Ładuję…" });
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [openQ, setOpenQ] = useState<string | null>(null);

  // ── Pełny raport: claim + result (user w apce jest zalogowany) ────────────
  const loadResult = useCallback(async (token: string) => {
    setPhase({ kind: "loading", label: "Ładuję raport…" });
    try {
      try {
        await api("/diagnosis/claim", { method: "POST", body: { token } });
      } catch (e) {
        // Konto ma już inną diagnozę — pokazujemy TĘ zapisaną (jedna na konto).
        if (e instanceof ApiError && e.status === 409 && e.data?.token) {
          token = e.data.token as string;
        } else if (e instanceof ApiError && e.status === 403) {
          setPhase({ kind: "error", message: "To podejście jest przypisane do innego konta." });
          return;
        } else {
          throw e;
        }
      }
      const result = await api<FullResult>(`/diagnosis/result/${encodeURIComponent(token)}`);
      setOpenQ(null);
      setPhase({ kind: "result", result });
    } catch {
      setPhase({
        kind: "error",
        message: "Nie udało się pobrać raportu. Spróbuj ponownie za chwilę.",
      });
    }
  }, []);

  // ── Wybór przedmiotu ────────────────────────────────────────────────────────
  const loadSubjects = useCallback(async () => {
    setPhase({ kind: "pick", subjects: null });
    try {
      const d = await api<{ subjects: DiagSubject[] }>("/diagnosis/subjects", { auth: false });
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
    // Diagnoza jest jedna na konto: jeśli już jest, od razu raport.
    (async () => {
      try {
        const mine = await api<{ diagnoses: { token: string }[] }>("/diagnosis/mine");
        const t = mine?.diagnoses?.[0]?.token;
        if (t) {
          await loadResult(t);
          return;
        }
      } catch {}
      await loadSubjects();
    })();
  }, [params.token, loadResult, loadSubjects]);

  // Panel „zakończ mimo braków” traci aktualność przy każdej zmianie.
  useEffect(() => {
    setConfirmFinish(false);
  }, [idx, answers]);

  const start = async (subject: DiagSubject) => {
    setPhase({ kind: "loading", label: "Losuję pytania…" });
    try {
      const d = await api<{ token: string; questions: DiagQuestion[] }>("/diagnosis/start", {
        method: "POST",
        body: { subject: subject.slug },
      });
      setIdx(0);
      setAnswers({});
      setPhase({ kind: "playing", subject, token: d.token, questions: d.questions });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.token) {
        await loadResult(e.data.token as string);
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

  const submit = async () => {
    if (phase.kind !== "playing") return;
    const token = phase.token;
    setPhase({ kind: "loading", label: "Oceniam…" });
    try {
      await api("/diagnosis/submit", { method: "POST", body: { token, answers } });
      await loadResult(token);
    } catch {
      setPhase({ kind: "error", message: "Nie udało się ocenić diagnozy. Spróbuj ponownie." });
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
          Jak poszedłby Ci dziś egzamin?
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 18 }}>
          13 pytań z różnych działów — w ~10 minut zobaczysz, które działy masz
          opanowane, a które wymagają pracy. Bez opłat, wynik od razu.
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
                      {shortName(s.name)}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                      13 pytań · ok. 10 minut
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
    const rows = [...(r.topicBreakdown ?? [])].sort(
      (a, b) => a.earned / a.total - b.earned / b.total,
    );
    const weak = rows.filter((t) => t.earned / t.total < 0.5);
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
        <Header title={`Diagnoza · ${shortName(r.subject.name)}`} />
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
          <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 12 }}>
            Twoje działy — od najsłabszego
          </Text>
          <View style={{ gap: 10 }}>
            {rows.map((t) => {
              const pct = Math.round((t.earned / t.total) * 100);
              const color = pct < 40 ? colors.red[500] : pct < 70 ? "#f59e0b" : colors.brand[500];
              return (
                <View key={t.topicId}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ flex: 1, fontSize: 13, color: theme.text }} numberOfLines={1}>
                      {t.topicName}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 8 }}>{pct}%</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        <Card style={{ marginBottom: 16, backgroundColor: colors.brand[500] + "14", borderColor: colors.brand[500] }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 6 }}>
            {weak.length > 0 ? "Najwięcej tracisz tutaj" : "Solidna baza — teraz przełóż ją na wynik"}
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 12 }}>
            {weak.length > 0
              ? `${weak
                  .slice(0, 3)
                  .map((t) => t.topicName)
                  .join(", ")}. W Premium odblokowujesz pytania z tych działów, pełne arkusze na czas i ocenę wypowiedzi pisemnych.`
              : "Diagnoza sprawdza podstawy. O wyniku decydują zadania otwarte i wypracowania — te odblokowujesz w Premium, razem z pełnymi arkuszami na czas."}
          </Text>
          <Button
            title="Odblokuj pełne quizy i arkusze →"
            onPress={() => navigation.getParent()?.navigate("ProfileTab", { screen: "Subscription" })}
            size="sm"
          />
        </Card>

        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 10 }}>
          Pytania i odpowiedzi
        </Text>
        <View style={{ gap: 8, marginBottom: 20 }}>
          {r.questions.map((q, i) => {
            const open = openQ === q.id;
            const badge = q.isCorrect ? colors.brand[500] : q.score > 0 ? "#f59e0b" : colors.red[500];
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
                  onPress={() => setOpenQ(open ? null : q.id)}
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
                      {q.isCorrect ? "✓" : q.score > 0 ? "½" : "✗"}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, color: theme.text }}>
                    {i + 1}. {parseChemText(String(q.content?.question ?? ""))}
                  </Text>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
                </TouchableOpacity>
                {open && (
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

        <TouchableOpacity onPress={() => void loadSubjects()} style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>Powtórz diagnozę — inny zestaw pytań →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Rozwiązywanie ───────────────────────────────────────────────────────────
  const { questions, subject } = phase;
  const q = questions[idx];
  const set = (value: any) => setAnswers((a) => ({ ...a, [q.id]: value }));
  const answered = answers[q.id] !== undefined;
  const incompleteNums = questions
    .map((qq, i) => (isComplete(qq, answers[qq.id]) ? null : i + 1))
    .filter((n): n is number => n !== null);
  const cur = answers[q.id];

  return (
    <ScrollView style={container} contentContainerStyle={content} keyboardShouldPersistTaps="handled">
      <Header title={`Diagnoza · ${shortName(subject.name)}`} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: theme.textSecondary }}>
          Pytanie {idx + 1} z {questions.length}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            color: theme.textSecondary,
            backgroundColor: theme.inputBg,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            maxWidth: "60%",
          }}
        >
          {q.topicName}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.border, marginBottom: 12, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${((idx + 1) / questions.length) * 100}%`, backgroundColor: colors.brand[500] }} />
      </View>

      {/* Nawigator 1–13: skok do dowolnego pytania + widok, co jest nieuzupełnione */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {questions.map((qq, i) => {
          const complete = isComplete(qq, answers[qq.id]);
          const current = i === idx;
          return (
            <TouchableOpacity
              key={qq.id}
              onPress={() => setIdx(i)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: complete ? colors.brand[500] : theme.inputBg,
                borderWidth: 2,
                borderColor: current ? theme.text : "transparent",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: complete ? "#fff" : theme.textSecondary }}>
                {i + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 16, color: theme.text, lineHeight: 24, marginBottom: 14 }}>
          {parseChemText(q.content.question)}
        </Text>
        {q.content.imageUrl ? (
          <Image
            source={{ uri: q.content.imageUrl }}
            style={{ width: "100%", height: 200, borderRadius: radius.xl, marginBottom: 14 }}
            resizeMode="contain"
          />
        ) : null}

        {q.type === "CLOSED" && (
          <View style={{ gap: 8 }}>
            {(q.content.options ?? []).map((o) => (
              <OptionCard
                key={o.id}
                id={o.id}
                text={parseChemText(o.text)}
                state={cur === o.id ? "selected" : "default"}
                onPress={() => set(o.id)}
              />
            ))}
          </View>
        )}

        {q.type === "MULTI_SELECT" && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>Zaznacz wszystkie poprawne odpowiedzi.</Text>
            {(q.content.options ?? []).map((o) => {
              const sel: string[] = Array.isArray(cur) ? cur : [];
              const on = sel.includes(o.id);
              return (
                <OptionCard
                  key={o.id}
                  id={o.id}
                  text={parseChemText(o.text)}
                  state={on ? "selected" : "default"}
                  onPress={() => set(on ? sel.filter((x) => x !== o.id) : [...sel, o.id])}
                />
              );
            })}
          </View>
        )}

        {q.type === "TRUE_FALSE" && (
          <View style={{ gap: 10 }}>
            {(q.content.statements ?? []).map((s, i) => {
              const arr: (boolean | undefined)[] = Array.isArray(cur) ? cur : [];
              const setStatement = (v: boolean) => {
                const next = [...arr];
                next[i] = v;
                set(next);
              };
              return (
                <View
                  key={i}
                  style={{ padding: 12, borderRadius: radius.xl, borderWidth: 1, borderColor: theme.cardBorder }}
                >
                  <Text style={{ fontSize: 14, color: theme.text, marginBottom: 10, lineHeight: 20 }}>
                    {parseChemText(s.text)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(
                      [
                        [true, "Prawda"],
                        [false, "Fałsz"],
                      ] as const
                    ).map(([v, label]) => {
                      const on = arr[i] === v;
                      return (
                        <TouchableOpacity
                          key={label}
                          onPress={() => setStatement(v)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 14,
                            borderWidth: 2,
                            alignItems: "center",
                            borderColor: on ? colors.brand[500] : theme.border,
                            backgroundColor: on ? colors.brand[500] + "1A" : "transparent",
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "600", color: on ? colors.brand[600] : theme.textSecondary }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {q.type === "MATCHING" && (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>
              Do każdego elementu z lewej dobierz jeden z prawej.
            </Text>
            {(q.content.left ?? []).map((l) => {
              const map: Record<string, string> = cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {};
              return (
                <View
                  key={l}
                  style={{ padding: 12, borderRadius: radius.xl, borderWidth: 1, borderColor: theme.cardBorder }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text, marginBottom: 8 }}>
                    {parseChemText(l)}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {(q.content.right ?? []).map((rgt) => {
                      const on = map[l] === rgt;
                      return (
                        <TouchableOpacity
                          key={rgt}
                          onPress={() => set({ ...map, [l]: rgt })}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: on ? colors.brand[500] : theme.border,
                            backgroundColor: on ? colors.brand[500] : "transparent",
                          }}
                        >
                          <Text style={{ fontSize: 13, color: on ? "#fff" : theme.text }}>{parseChemText(rgt)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title="← Poprzednie"
          onPress={() => setIdx((i) => Math.max(0, i - 1))}
          variant="outline"
          disabled={idx === 0}
          style={{ flex: 1 }}
        />
        {idx < questions.length - 1 ? (
          <Button
            title="Następne →"
            onPress={() => setIdx((i) => i + 1)}
            disabled={!answered}
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            title="Zakończ i pokaż wynik"
            onPress={() => (incompleteNums.length > 0 ? setConfirmFinish(true) : void submit())}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {confirmFinish && (
        <Card style={{ marginTop: 14, borderColor: "#f59e0b" }}>
          <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19, marginBottom: 10 }}>
            {incompleteNums.length === 1
              ? `Pytanie ${incompleteNums[0]} nie ma pełnej odpowiedzi.`
              : `Pytania ${incompleteNums.join(", ")} nie mają pełnej odpowiedzi.`}{" "}
            Nieuzupełnione pozycje liczą się jako błędne.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              title={`Uzupełnij ${incompleteNums[0]}`}
              onPress={() => {
                setConfirmFinish(false);
                setIdx(incompleteNums[0] - 1);
              }}
              size="sm"
              style={{ flex: 1 }}
            />
            <Button
              title="Zakończ mimo to"
              onPress={() => {
                setConfirmFinish(false);
                void submit();
              }}
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
