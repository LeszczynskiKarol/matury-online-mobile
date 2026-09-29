// src/screens/exam/ExamResultsScreen.tsx

// ============================================================================
// ExamResultsScreen — Review mode with grading overlay
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { cleanInstructionForDisplay } from "../../utils/examInstruction";
import { isGapTextType } from "../../utils/gapText";
import { GapTextReview } from "../../components/exam/GapText";
import { PASS_PERCENT, hasPassThreshold, verdictLineFor } from "../../utils/passThreshold";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { parseChemText } from "../../utils/chemText";
import { CodeAwareText } from "../../components/common/CodeAwareText";
import { MaterialRenderer, StructTableView } from "../../components/exam/MaterialRenderer";
import { TextWithTables } from "../../components/common/TextWithTables";
import { getExamResults, gradeExamWithAI, resetExam } from "../../api/exams";
import { api } from "../../api/client";
import { getPracticeLinks, type PracticeLinks } from "../../api/premium";
import { maybeAskForReview } from "../../lib/reviewPrompt";
import { TestimonialPrompt } from "../../components/feedback/TestimonialPrompt";
import { askForPushPermissionOnce } from "../../lib/pushNotifications";
import type { ExamStackParamList } from "../../navigation/types";
import { ReportButton } from "../../components/quiz/ReportQuestion";
import { examTaskTypeLabel } from "../../utils/examTaskLabels";
import { daysToMatura } from "../../components/common/PremiumGate";
import { examPartName } from "../../utils/languageTaskLabels";

type Nav = NativeStackNavigationProp<ExamStackParamList>;

// ── Framing wyniku: dystans w PUNKTACH, nie w procentach ────────────────────
// „Masz 43%" nic uczniowi nie mówi. „Do progu brakuje Ci 5 pkt" mówi wszystko.
// Progi: 30% to próg zdawalności CKE (TYLKO matura PP z przedmiotu
// obowiązkowego — utils/passThreshold.ts; rozszerzenia i przedmioty dodatkowe
// progu nie mają), 65% i 85% to poziomy, na których wynik zaczyna się liczyć
// w rekrutacji. Identyczne z wersją webową.
const RECRUIT_PERCENT = 65;
const TOP_PERCENT = 85;

function pointsTo(target: number, totalScore: number, maxScore: number) {
  return Math.max(0, Math.ceil((maxScore * target) / 100) - totalScore);
}

// Ile miesięcy zostało do najbliższej matury — do ramowania „ten wynik da się
// jeszcze podnieść” przy najniższych wynikach (jak web monthsToMatura).
// Minimum 1, żeby tuż przed egzaminem nie wyszło „masz na to 0 miesięcy”.
function monthsToMatura(): number {
  const days = daysToMatura();
  if (days === null) return 8;
  return Math.max(1, Math.floor(days / 30.44));
}

function monthsLabel(n: number): string {
  if (n === 1) return "1 miesiąc";
  if (n >= 2 && n <= 4) return `${n} miesiące`;
  return `${n} miesięcy`;
}

function getOutcomeFraming(
  percentage: number,
  totalScore: number,
  maxScore: number,
  threshold: boolean,
) {
  const toPass = pointsTo(PASS_PERCENT, totalScore, maxScore);
  const toRecruit = pointsTo(RECRUIT_PERCENT, totalScore, maxScore);
  const toTop = pointsTo(TOP_PERCENT, totalScore, maxScore);
  const passMargin = totalScore - Math.ceil((maxScore * PASS_PERCENT) / 100);

  // Egzamin bez progu zdawalności (PR, przedmiot dodatkowy): ani „zdane”, ani
  // „do progu brakuje” — sam dystans do poziomów rekrutacyjnych.
  if (!threshold && percentage < RECRUIT_PERCENT) {
    const months = monthsLabel(monthsToMatura());
    return {
      distance: `Do wyniku, który liczy się w rekrutacji (${RECRUIT_PERCENT}%), brakuje Ci ${toRecruit} pkt${percentage < 50 ? ` — masz na to jeszcze ${months}` : ""}.`,
      upsellTitle:
        percentage < PASS_PERCENT
          ? `Ten wynik da się podnieść — masz na to ${months}`
          : `Do progu rekrutacyjnego brakuje ${toRecruit} pkt`,
      upsellBody:
        percentage < PASS_PERCENT
          ? "Najtrudniejsze już za Tobą: wiesz dokładnie, które działy kosztują Cię punkty i od czego zacząć — plan naprawczy jest wyżej. W Premium ćwiczysz dokładnie te działy i wracasz do kolejnych arkuszy, żeby zobaczyć, jak różnica znika."
          : "W Premium ćwiczysz słabsze obszary i sprawdzasz postęp na kolejnych arkuszach.",
    };
  }

  if (percentage < PASS_PERCENT) {
    // Rama ratunkowa, nie porażkowa: komunikat ma mówić „jest plan i jest
    // czas”, a nie dobijać procentem.
    const months = monthsLabel(monthsToMatura());
    return {
      distance: `Do progu zdawalności brakuje Ci ${toPass} pkt — masz na to jeszcze ${months}.`,
      upsellTitle: `Ten wynik da się podnieść — masz na to ${months}`,
      upsellBody:
        "Najtrudniejsze już za Tobą: wiesz dokładnie, które działy kosztują Cię punkty i od czego zacząć — plan naprawczy jest wyżej. W Premium ćwiczysz dokładnie te działy i wracasz do kolejnych arkuszy, żeby zobaczyć, jak różnica znika.",
    };
  }
  if (percentage < 50) {
    return {
      distance: `Zdane, ale zapas nad progiem to tylko ${passMargin} pkt. Do wyniku liczącego się w rekrutacji brakuje ${toRecruit} pkt.`,
      upsellTitle: "Zdane — ale bez zapasu",
      upsellBody: `Przy takim marginesie o wyniku decyduje jeden gorszy dzień. W Premium dobijesz te ${toRecruit} pkt, ćwicząc dokładnie to, co dziś kosztowało Cię najwięcej.`,
    };
  }
  if (percentage < RECRUIT_PERCENT) {
    return {
      distance: `Zdane pewnie. Do wyniku, który liczy się w rekrutacji (${RECRUIT_PERCENT}%), brakuje ${toRecruit} pkt.`,
      upsellTitle: `Do progu rekrutacyjnego brakuje ${toRecruit} pkt`,
      upsellBody:
        "Na tym poziomie nie chodzi już o zdanie, tylko o kierunek studiów. W Premium ćwiczysz słabsze obszary i sprawdzasz postęp na kolejnych arkuszach.",
    };
  }
  if (percentage < TOP_PERCENT) {
    return {
      distance: `Mocny wynik. Do bardzo dobrego (${TOP_PERCENT}%) brakuje ${toTop} pkt.`,
      upsellTitle: `Do bardzo dobrego wyniku brakuje ${toTop} pkt`,
      upsellBody:
        "Masz bazę, której większość dopiero szuka. Te ostatnie punkty schodzą najwolniej — z regularnych powtórek i kolejnych arkuszy, nie z jednego podejścia.",
    };
  }
  return {
    distance: "Wynik na poziomie najlepszych — rzecz w tym, żeby go utrzymać.",
    upsellTitle: "Ten poziom trzeba utrzymać do maja",
    upsellBody:
      "Forma bez treningu spada, a do matury zostało sporo czasu. W Premium masz kolejne arkusze i pytania dobierane pod Twój poziom, żeby ten wynik był Twoim minimum, nie rekordem.",
  };
}

function getScoreTier(pct: number, isDark: boolean) {
  if (pct >= 85)
    return {
      tier: "excellent",
      emoji: "🏆",
      label: "Doskonale!",
      color: isDark ? "#34d399" : "#059669",
      bg: isDark ? "#05966910" : "#ecfdf5",
      border: isDark ? "#05966940" : "#a7f3d0",
    };
  if (pct >= 65)
    return {
      tier: "good",
      emoji: "🎉",
      label: "Dobry wynik!",
      // Zielony marki jak web (text-brand-600), nie niebieski.
      color: isDark ? "#4ade80" : "#16a34a",
      bg: isDark ? "#22c55e10" : "#f0fdf4",
      border: isDark ? "#22c55e40" : "#bbf7d0",
    };
  if (pct >= 50)
    return {
      tier: "decent",
      emoji: "📝",
      label: "Zdany",
      color: isDark ? "#fbbf24" : "#d97706",
      bg: isDark ? "#d9770610" : "#fffbeb",
      border: isDark ? "#d9770640" : "#fde68a",
    };
  if (pct >= 30)
    return {
      tier: "borderline",
      emoji: "⚠️",
      label: "Na granicy",
      color: isDark ? "#fb923c" : "#ea580c",
      bg: isDark ? "#ea580c10" : "#fff7ed",
      border: isDark ? "#ea580c40" : "#fed7aa",
    };
  return {
    tier: "failed",
    emoji: "💪",
    label: "Niezdany — nie poddawaj się!",
    color: isDark ? "#f87171" : "#dc2626",
    bg: isDark ? "#dc262610" : "#fef2f2",
    border: isDark ? "#dc262640" : "#fecaca",
  };
}

/** Kolor wyniku części / zadań z odpowiedzią — jak web: < 40% czerwony,
 *  < 70% żółty, reszta zielony marki (czytelne w obu motywach). */
function scoreTone(pct: number, isDark: boolean): string {
  if (pct < 40) return isDark ? "#f87171" : "#dc2626";
  if (pct < 70) return isDark ? "#fbbf24" : "#d97706";
  return isDark ? "#4ade80" : "#16a34a";
}

function hasResponse(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some(hasResponse);
  return true;
}

export function ExamResultsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const { attemptId } = route.params as { attemptId: string };

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradingProgress, setGradingProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState("__summary__");
  const [showNav, setShowNav] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  // Jak w graczu egzaminu i w wersji webowej: materiał widoczny od razu.
  const [showMaterials, setShowMaterials] = useState(true);
  // Powtórka arkusza = kolejne ocenianie AI, więc jest wyłącznie dla Premium.
  // Konto z ofertą próbną widzi w tym miejscu upsell zamiast przycisku —
  // inaczej „rozwiąż od nowa" byłoby pętlą przepalającą darmową pulę kredytów.
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [practice, setPractice] = useState<PracticeLinks | null>(null);
  // Zmiana zadania zaczyna od góry (jak web window.scrollTo) — wcześniej
  // nowe zadanie otwierało się w połowie, na wysokości poprzedniego.
  const scrollRef = useRef<ScrollView>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [regrading, setRegrading] = useState(false);
  // Karta „Darmowa próbka quizu” w „Co dalej?” (konto bez Premium, web
  // DiagnosisSampleCard): diagnoza jest jedna na konto — zrobiona → brak
  // karty, rozpoczęta → „Dokończ…”.
  const [diagCard, setDiagCard] = useState<
    { kind: "none" } | { kind: "todo" } | { kind: "progress"; name: string }
  >({ kind: "none" });
  useEffect(() => {
    Promise.all([
      api<any>("/diagnosis/mine").catch(() => null),
      api<any>("/diagnosis/v2/current").catch(() => null),
    ]).then(([mine, cur]) => {
      const c = cur?.current;
      if ((mine?.diagnoses ?? []).length > 0 || c?.completed) return;
      if (c?.subject?.name) setDiagCard({ kind: "progress", name: c.subject.name });
      else setDiagCard({ kind: "todo" });
    });
  }, []);

  useEffect(() => {
    api<{ isPremium: boolean }>("/stripe/status")
      .then((d) => setIsPremium(d?.isPremium ?? false))
      .catch(() => setIsPremium(false));
    // Most z rekomendacji AI do banku pytań — osobny strzał, bo wyniki są
    // pollingowane w trakcie oceniania i nie ma powodu liczyć tego za każdym
    // odpytaniem.
    getPracticeLinks(attemptId)
      .then(setPractice)
      .catch(() => {});
  }, [attemptId]);

  // Fetch with polling. `reloadKey` — po „Oceń z AI” polling startuje od nowa
  // (wcześniej interwał był już wyczyszczony i ekran oceniania wisiał).
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    let off = false;
    // Chwilowe błędy sieci / restart serwera w trakcie oceniania — ponawiamy.
    let transient = 0;

    const go = async () => {
      try {
        const r = await getExamResults(attemptId);
        if (off) return;

        if (r.status === "GRADING") {
          setError("GRADING");
          setLoading(false);
          setGradingProgress((p) => Math.min(p + 3 + Math.random() * 5, 92));
          if (!poll) poll = setInterval(go, 5000);
          return;
        }
        if (poll) clearInterval(poll);
        // Porzucony (pusty) arkusz nie ma wyniku — wracamy do listy arkuszy.
        if (r.status === "ABANDONED") {
          navigation.replace("ExamSelector", { noAutoOpen: true });
          return;
        }
        transient = 0;
        setError(null);
        setData(r);
        setLoading(false);
        setCurrentTaskId("__summary__");
      } catch (e: any) {
        if (off) return;
        const fatal = typeof e?.status === "number" && e.status >= 400 && e.status < 500;
        if (!fatal && transient < 12) {
          transient++;
          if (!poll) poll = setInterval(go, 5000);
          return;
        }
        if (poll) clearInterval(poll);
        setError(fatal ? e.message : "Nie udało się pobrać wyniku — sprawdź połączenie i spróbuj ponownie.");
        setLoading(false);
      }
    };
    go();
    return () => {
      off = true;
      if (poll) clearInterval(poll);
    };
  }, [attemptId, reloadKey]);

  // In-app review: moment maksymalnej satysfakcji — dobrze zdany egzamin.
  // Cała logika progu/throttlingu w maybeAskForReview (lib/reviewPrompt).
  // Push: pierwszy ukończony egzamin to też właściwy moment na jednorazową
  // prośbę o zgodę na powiadomienia (kontekst > cold start).
  useEffect(() => {
    if (!data) return;
    askForPushPermissionOnce();
    const pct = data?.grading?.percentage;
    if (typeof pct === "number") maybeAskForReview(pct);
  }, [data]);

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.brand[500]} />
        <Text
          style={{ fontSize: 13, color: theme.textSecondary, marginTop: 12 }}
        >
          Ładowanie wyników...
        </Text>
      </View>
    );
  }

  // ── Grading spinner ────────────────────────────────────────────────
  if (error === "GRADING") {
    const steps = [
      "Zadania zamknięte",
      "Zadania otwarte — ocena AI",
      "Podsumowanie i rekomendacje",
      "Finalizacja",
    ];
    const cur = Math.floor(gradingProgress / 25);
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <ActivityIndicator size="large" color={colors.brand[500]} />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: theme.text,
            marginTop: 20,
            marginBottom: 16,
          }}
        >
          AI ocenia arkusz...
        </Text>
        <View
          style={{
            width: "100%",
            height: 8,
            backgroundColor: theme.border,
            borderRadius: 4,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.brand[500],
              width: `${gradingProgress}%`,
            }}
          />
        </View>
        {steps.map((s, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            {i < cur ? (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.brand[500]}
              />
            ) : i === cur ? (
              <ActivityIndicator size="small" color={colors.brand[500]} />
            ) : (
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: theme.border,
                }}
              />
            )}
            <Text
              style={{
                fontSize: 13,
                color: i <= cur ? theme.text : theme.textTertiary,
                fontWeight: i === cur ? "600" : "400",
              }}
            >
              {s}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 16 }}>⚠️</Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.textSecondary,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {error}
        </Text>
        <Button title="Wróć" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const { grading, feedback, exam } = data;
  // Poniżej 30% zadań z odpowiedzią backend wstrzymuje podsumowanie AI
  // i klucz przy zadaniach bez odpowiedzi (exam-live.ts /results).
  const summaryWithheld = !!(data.summaryWithheld || feedback?.summaryWithheld);
  if (!grading?.tasks) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 16 }}>
          {feedback?.error ? "⚠️" : "⏳"}
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center", lineHeight: 20 }}>
          {feedback?.message || "Wyniki niedostępne."}
        </Text>
        {/* Ocenianie padło przed zapisaniem ocen — /grade w tym stanie
            przejdzie, więc dajemy drogę wyjścia (jak web). */}
        <Button
          title={regrading ? "Uruchamianie oceny..." : "🔄 Oceń egzamin ponownie"}
          loading={regrading}
          onPress={async () => {
            setRegrading(true);
            try {
              await gradeExamWithAI(attemptId);
              setError("GRADING");
              setGradingProgress(0);
              setReloadKey((k) => k + 1);
            } catch (err: any) {
              Alert.alert("Nie udało się", err?.message || "Nie udało się rozpocząć oceny.");
            } finally {
              setRegrading(false);
            }
          }}
          style={{ marginTop: 20 }}
        />
        <Button
          title="Wróć"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 10 }}
        />
      </View>
    );
  }

  const examContent = exam.content;
  const gradingMap = new Map<string, any>(
    grading.tasks.map((t: any) => [t.taskId, t]),
  );
  const allTasks = examContent.parts.flatMap((p: any) =>
    p.tasks.map((t: any) => ({ ...t, partId: p.id, partName: p.name })),
  );
  // Pod-numeracja zadań (id → "2" lub "2.1") — jak web: kilka zadań z tym
  // samym `number` w części to podpunkty jednego zadania.
  const taskLabels: Record<string, string> = {};
  examContent.parts.forEach((p: any) => {
    const counts: Record<string, number> = {};
    p.tasks.forEach((t: any) => {
      const n = String(t.number);
      counts[n] = (counts[n] || 0) + 1;
    });
    const seen: Record<string, number> = {};
    p.tasks.forEach((t: any) => {
      const n = String(t.number);
      if (counts[n] > 1) {
        seen[n] = (seen[n] || 0) + 1;
        taskLabels[t.id] = `${n}.${seen[n]}`;
      } else {
        taskLabels[t.id] = n;
      }
    });
  });
  const labelOf = (t: any) => taskLabels[t?.id] ?? String(t?.number ?? "");
  // Materiały to zasób arkusza — zadanie może wskazywać materiał z innej
  // części (materialIds), więc szukamy w całym arkuszu, nie w bieżącej części.
  const allMaterials: any[] = examContent.parts.flatMap((p: any) => p.materials || []);
  const partResults: any[] = grading.partResults ?? [];
  const isSummary = currentTaskId === "__summary__";
  const currentTask = isSummary
    ? null
    : allTasks.find((t: any) => t.id === currentTaskId);
  const currentPart = currentTask
    ? examContent.parts.find((p: any) =>
        p.tasks.some((t: any) => t.id === currentTaskId),
      )
    : null;
  const currentIndex = isSummary
    ? -1
    : allTasks.findIndex((t: any) => t.id === currentTaskId);
  const currentGrading = currentTask ? gradingMap.get(currentTask.id) : null;
  const tier = getScoreTier(grading.percentage, isDark);
  const threshold = hasPassThreshold(exam?.subject?.slug, exam?.level);
  const verdict = verdictLineFor(
    feedback?.predictedMatura,
    exam?.subject?.slug,
    exam?.level,
  );
  const framing = getOutcomeFraming(
    grading.percentage,
    grading.totalScore,
    grading.maxScore,
    threshold,
  );

  const goToTask = (id: string) => {
    setCurrentTaskId(id);
    setShowNav(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const goNext = () => {
    if (isSummary) goToTask(allTasks[0].id);
    else if (currentIndex < allTasks.length - 1)
      goToTask(allTasks[currentIndex + 1].id);
    else goToTask("__summary__");
  };
  const goPrev = () => {
    if (isSummary) goToTask(allTasks[allTasks.length - 1].id);
    else if (currentIndex > 0) goToTask(allTasks[currentIndex - 1].id);
    else goToTask("__summary__");
  };

  // ══════════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ═══ RETRY MODAL ═══ */}
      <Modal visible={showRetryModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 24,
              padding: 28,
              width: "100%",
              maxWidth: 360,
            }}
          >
            <Text
              style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}
            >
              🔄
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: theme.text,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Rozwiązać od nowa?
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                textAlign: "center",
                marginBottom: 24,
                lineHeight: 20,
              }}
            >
              Twoje odpowiedzi i wyniki zostaną{" "}
              <Text style={{ fontWeight: "700", color: "#ef4444" }}>
                trwale usunięte
              </Text>
              .
            </Text>
            <TouchableOpacity
              disabled={retryLoading}
              onPress={async () => {
                setRetryLoading(true);
                try {
                  const res = await resetExam(attemptId);
                  navigation.replace("ExamPlay", {
                    examId: res.examId,
                    subjectId: "",
                  });
                } catch (err: any) {
                  Alert.alert("Błąd", err.message);
                  setRetryLoading(false);
                  setShowRetryModal(false);
                }
              }}
              style={{
                backgroundColor: "#ef4444",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                marginBottom: 8,
                opacity: retryLoading ? 0.5 : 1,
              }}
            >
              {retryLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}
                >
                  Tak, zacznij od nowa
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              disabled={retryLoading}
              onPress={() => setShowRetryModal(false)}
              style={{ paddingVertical: 12, alignItems: "center" }}
            >
              <Text style={{ fontSize: 14, color: theme.textTertiary }}>
                Anuluj
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ TASK NAV MODAL ═══ */}
      <Modal visible={showNav} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setShowNav(false)}
          />
          <View
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              maxHeight: "70%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: theme.text }}
              >
                Nawigacja
              </Text>
              <TouchableOpacity onPress={() => setShowNav(false)}>
                <Text style={{ fontSize: 16, color: theme.textTertiary }}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            {/* Summary button */}
            <TouchableOpacity
              onPress={() => goToTask("__summary__")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 14,
                marginBottom: 12,
                backgroundColor: isSummary ? colors.navy[500] : theme.inputBg,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isSummary ? "#fff" : theme.text,
                }}
              >
                📊 Podsumowanie
              </Text>
            </TouchableOpacity>
            <ScrollView>
              {/* Lista zadań jak web (boczny panel): część z wynikiem w kolorze
                  (< 40% czerwony, < 70% żółty), pod nią zadania — kropka stanu,
                  numer, typ zadania, punkty. */}
              {examContent.parts.map((part: any) => {
                const pr = partResults.find((x: any) => x.partId === part.id);
                const prPct = pr && pr.maxScore > 0 ? (pr.score / pr.maxScore) * 100 : 0;
                return (
                <View key={part.id} style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: theme.textTertiary,
                      letterSpacing: 0.8,
                      marginBottom: 6,
                      paddingHorizontal: 4,
                    }}
                  >
                    {examPartName(String(part.name).replace("Arkusz 2. ", ""), { short: true }).toUpperCase()}
                    {pr ? (
                      <Text style={{ color: scoreTone(prPct, isDark) }}>
                        {"  "}({pr.score}/{pr.maxScore})
                      </Text>
                    ) : null}
                  </Text>
                  <View style={{ gap: 2 }}>
                    {part.tasks.map((task: any) => {
                      const tg = gradingMap.get(task.id);
                      const isCur = task.id === currentTaskId;
                      const ungraded = !!(tg as any)?._ungraded;
                      const dotColor = ungraded
                        ? "#a855f7"
                        : tg?.isCorrect
                          ? colors.brand[500]
                          : (tg?.pointsEarned ?? 0) > 0
                            ? "#f59e0b"
                            : "#ef4444";
                      const ptsColor = isCur
                        ? "rgba(255,255,255,0.85)"
                        : ungraded
                          ? "#a855f7"
                          : tg?.isCorrect
                            ? isDark ? "#4ade80" : "#16a34a"
                            : (tg?.pointsEarned ?? 0) > 0
                              ? isDark ? "#fbbf24" : "#d97706"
                              : isDark ? "#f87171" : "#dc2626";
                      const lbl = labelOf(task);
                      return (
                        <TouchableOpacity
                          key={task.id}
                          onPress={() => goToTask(task.id)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 12,
                            backgroundColor: isCur ? colors.navy[500] : "transparent",
                          }}
                        >
                          <View
                            style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dotColor }}
                          />
                          <Text
                            style={{
                              minWidth: 34,
                              fontSize: 13,
                              fontWeight: "700",
                              color: isCur ? "#fff" : theme.text,
                            }}
                          >
                            {lbl}
                            {lbl.includes(".") ? "" : "."}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: isCur ? "#fff" : theme.textSecondary,
                            }}
                          >
                            {examTaskTypeLabel(task.type)}
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: ptsColor }}>
                            {ungraded ? "?" : (tg?.pointsEarned ?? 0)}/{tg?.maxPoints ?? task.points}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ TOP BAR ═══ */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          backgroundColor: theme.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: tier.bg,
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "800", color: tier.color }}
            >
              {grading.totalScore}/{grading.maxScore} ({grading.percentage}%)
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>
              {isSummary
                ? "Podsumowanie"
                : `Zad. ${labelOf(currentTask)} · ${currentIndex + 1} z ${allTasks.length}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowNav(true)}
            style={{ padding: 8 }}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("ExamSelector")}
            style={{ padding: 8 }}
          >
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ CONTENT ═══ */}
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Opinia po arkuszu od 50%, jak na webie (nad treścią, Karol
            28.09.2026). Powtórki ogranicza backend (max 3 wyświetlenia, co 3 dni). */}
        {grading.percentage >= 50 && (
          <TestimonialPrompt
            trigger="exam"
            context={{
              percentage: grading.percentage,
              subject: data?.exam?.subject?.slug ?? examContent?.subject ?? null,
            }}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* ── SUMMARY ── układ i kolejność jak web ExamResults.tsx ── */}
        {isSummary && (
          <View>
            {/* „Oddaj to, co masz": przy niepełnym arkuszu osobno wynik z zadań,
                na które była odpowiedź — procent z całości nic wtedy nie mówi. */}
            {(() => {
              const ts: any[] = grading.tasks;
              const done = ts.filter((t) => hasResponse(t.userResponse));
              if (done.length === 0 || done.length === ts.length) return null;
              const got = done.reduce((a, t) => a + (t.pointsEarned || 0), 0);
              const max = done.reduce((a, t) => a + (t.maxPoints || 0), 0);
              const pct = max > 0 ? Math.round((got / max) * 100) : 0;
              return (
                <View
                  style={{
                    borderRadius: 20,
                    padding: 18,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: isDark ? colors.brand[800] : colors.brand[200],
                    backgroundColor: isDark ? colors.brand[900] + "33" : colors.brand[50],
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: isDark ? colors.brand[300] : colors.brand[700],
                      letterSpacing: 0.8,
                      marginBottom: 4,
                    }}
                  >
                    WYNIK Z ROZWIĄZANYCH ZADAŃ
                  </Text>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: scoreTone(pct, isDark) }}>
                    {got}/{max} pkt ({pct}%)
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4, lineHeight: 19 }}>
                    {summaryWithheld
                      ? `Masz odpowiedzi w ${done.length} z ${ts.length} zadań · punkty z całego arkusza: ${grading.totalScore}/${grading.maxScore} (zadania bez odpowiedzi liczą się za 0 pkt).`
                      : `Masz odpowiedzi w ${done.length} z ${ts.length} zadań. Poniżej wynik z całego arkusza — zadania bez odpowiedzi liczą się w nim za 0 pkt.`}
                  </Text>
                </View>
              );
            })()}

            {/* Nagłówek wyniku: trzy warianty jak web — za mało odpowiedzi,
                ratunkowy (poniżej 30%) i zwykły. */}
            <View
              style={{
                borderRadius: 20,
                padding: 22,
                marginBottom: 16,
                backgroundColor: summaryWithheld ? theme.card : tier.bg,
                borderWidth: 1,
                borderColor: summaryWithheld ? theme.cardBorder : tier.border,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>
                {summaryWithheld ? "📝" : tier.tier === "failed" ? "🧭" : tier.emoji}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: theme.text,
                  textAlign: "center",
                  marginBottom: 4,
                }}
              >
                {exam.title}
              </Text>
              {summaryWithheld ? (
                <>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: theme.text,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    Arkusz rozwiązany tylko w części
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      textAlign: "center",
                      marginTop: 8,
                      lineHeight: 19,
                    }}
                  >
                    {typeof data?.answeredRatio === "number"
                      ? `Odpowiedzi masz w ${Math.round(data.answeredRatio * 100)}% zadań — to za mało, żeby ocenić Twój poziom.`
                      : "To za mało odpowiedzi, żeby ocenić Twój poziom."}
                  </Text>
                </>
              ) : tier.tier === "failed" ? (
                <>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: theme.text,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    Masz punkt startu — i gotowy plan naprawczy
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: tier.color,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    Punkt startu: {grading.totalScore}/{grading.maxScore} pkt ({grading.percentage}%)
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      textAlign: "center",
                      marginTop: 10,
                      lineHeight: 19,
                    }}
                  >
                    {framing.distance}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      textAlign: "center",
                      marginTop: 4,
                      lineHeight: 19,
                    }}
                  >
                    Niżej widzisz, które działy kosztowały Cię najwięcej punktów i od czego zacząć.
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "800",
                      color: tier.color,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    {grading.totalScore}/{grading.maxScore} pkt ({grading.percentage}%)
                  </Text>
                  {verdict ? (
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: tier.color,
                        textAlign: "center",
                        marginTop: 6,
                      }}
                    >
                      {verdict}
                    </Text>
                  ) : null}
                  {/* Dystans w punktach — najużyteczniejsza liczba na ekranie. */}
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      textAlign: "center",
                      marginTop: 10,
                      lineHeight: 19,
                    }}
                  >
                    {framing.distance}
                  </Text>
                </>
              )}

              {/* Wynik części arkusza w kolorach (jak lista części na webie). */}
              {partResults.length > 1 && (
                <View style={{ alignSelf: "stretch", marginTop: 16, gap: 6 }}>
                  {partResults.map((pr: any) => {
                    const pct = pr.maxScore > 0 ? (pr.score / pr.maxScore) * 100 : 0;
                    return (
                      <View
                        key={pr.partId}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)",
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 13, color: theme.text }}>
                          {examPartName(String(pr.partName ?? "").replace("Arkusz 2. ", ""), { short: true })}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: scoreTone(pct, isDark) }}>
                          {pr.score}/{pr.maxScore}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {summaryWithheld ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  marginBottom: 20,
                  borderLeftWidth: 4,
                  borderLeftColor: "#f59e0b",
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                }}
              >
                <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
                  {(data as any).keysVisible
                    ? "ℹ️ Ogólne omówienie arkusza pojawi się, gdy odpowiesz na co najmniej 30% zadań — rozwiązania wszystkich zadań masz poniżej."
                    : "ℹ️ Podsumowanie i omówienie arkusza pojawią się, gdy odpowiesz na co najmniej 30% zadań. Zadania bez odpowiedzi nie pokazują klucza."}
                </Text>
              </View>
            ) : feedback?.motivationalMessage ? (
              <Text
                style={{
                  fontSize: 13,
                  color: theme.textSecondary,
                  fontStyle: "italic",
                  textAlign: "center",
                  marginBottom: 20,
                  lineHeight: 20,
                }}
              >
                {feedback.motivationalMessage}
              </Text>
            ) : null}

            {/* „Oceń z AI” — wynik częściowy (jak web: trzy warianty opisu). */}
            {feedback?.isPartialGrading && (
              <View
                style={{
                  padding: 18,
                  borderRadius: 16,
                  marginBottom: 20,
                  alignItems: "center",
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: isDark ? "#6b21a8" : "#d8b4fe",
                  backgroundColor: isDark ? "#5b21b610" : "#faf5ff",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.textSecondary,
                    marginBottom: 12,
                    textAlign: "center",
                    lineHeight: 19,
                  }}
                >
                  {(feedback as any).aiFailedTasks
                    ? `⚡ Wynik częściowy — ${(feedback as any).aiFailedTasks} zad. nie udało się ocenić z powodu błędu AI (0 pkt nie wynika z Twoich odpowiedzi).`
                    : (feedback as any).noCredits
                      ? "⚡ Wynik częściowy — zadania otwarte czekają na ocenę AI (zabrakło kredytów przy oddaniu)."
                      : "⚡ Wynik częściowy — zadania otwarte (wypracowanie, notatka, listening) nie zostały ocenione."}
                </Text>
                <TouchableOpacity
                  disabled={regrading}
                  onPress={async () => {
                    setGradeError(null);
                    setRegrading(true);
                    try {
                      await gradeExamWithAI(attemptId);
                      setError("GRADING");
                      setGradingProgress(0);
                      setReloadKey((k) => k + 1);
                    } catch (err: any) {
                      setGradeError(err?.message || "Nie udało się rozpocząć oceny.");
                    } finally {
                      setRegrading(false);
                    }
                  }}
                  style={{
                    backgroundColor: "#7c3aed",
                    borderRadius: 14,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    opacity: regrading ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff", textAlign: "center" }}>
                    {regrading ? "Uruchamianie oceny..." : "🤖 Oceń z AI (pełna ocena CKE)"}
                  </Text>
                </TouchableOpacity>
                {gradeError ? (
                  <Text style={{ fontSize: 12, color: isDark ? "#f87171" : "#dc2626", marginTop: 8, textAlign: "center" }}>
                    {gradeError}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 8, textAlign: "center", lineHeight: 16 }}>
                    Kredyty AI schodzą tylko za zadania otwarte z odpowiedzią. Ocena zajmie ~1–3 min.
                  </Text>
                )}
              </View>
            )}

            {/* Podsumowanie AI — wstrzymane poniżej progu 30% odpowiedzi */}
            {!summaryWithheld && (
              <>
                {/* Mocne strony / Do poprawy — jedna pod drugą (web na telefonie). */}
                {[
                  { title: "💪 Mocne strony", items: feedback?.strengths ?? [], mark: "✓", markColor: colors.brand[500] },
                  { title: "⚠️ Do poprawy", items: feedback?.weaknesses ?? [], mark: "!", markColor: "#ef4444" },
                ].map((box) =>
                  box.items.length > 0 ? (
                    <Card key={box.title} style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 8 }}>
                        {box.title}
                      </Text>
                      {box.items.map((s: string, i: number) => (
                        <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 5 }}>
                          <Text style={{ fontSize: 13, color: box.markColor, fontWeight: "800" }}>{box.mark}</Text>
                          <Text style={{ fontSize: 13, color: theme.textSecondary, flex: 1, lineHeight: 19 }}>
                            {s}
                          </Text>
                        </View>
                      ))}
                    </Card>
                  ) : null,
                )}

                {(feedback?.recommendations ?? []).length > 0 && (
                  <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 8, marginBottom: 10 }}>
                    🎯 Rekomendacje
                  </Text>
                )}
                {(feedback?.recommendations ?? []).map((rec: any, i: number) => (
                  <Card
                    key={i}
                    style={{
                      marginBottom: 10,
                      borderLeftWidth: 4,
                      borderLeftColor:
                        rec.priority === "high" ? "#ef4444" : rec.priority === "medium" ? "#f59e0b" : "#d4d4d8",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 99,
                          backgroundColor:
                            rec.priority === "high"
                              ? isDark ? "#7f1d1d55" : "#fef2f2"
                              : rec.priority === "medium"
                                ? isDark ? "#78350f55" : "#fffbeb"
                                : isDark ? "#3f3f4655" : "#f4f4f5",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color:
                              rec.priority === "high"
                                ? isDark ? "#fca5a5" : "#dc2626"
                                : rec.priority === "medium"
                                  ? isDark ? "#fcd34d" : "#d97706"
                                  : isDark ? "#d4d4d8" : "#71717a",
                          }}
                        >
                          {rec.priority === "high" ? "🔴 Wysoki" : rec.priority === "medium" ? "🟡 Średni" : "🟢 Niski"}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text, flexShrink: 1 }}>
                        {rec.area}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>
                      {rec.description}
                    </Text>
                    {/* Most do banku pytań — tylko gdy dopasowanie trafiło
                        w konkretny dział i coś w nim jest. */}
                    {(() => {
                      const link = practice?.links?.[i];
                      if (!link?.topicId || link.questionCount === 0) return null;
                      return (
                        <TouchableOpacity
                          onPress={() => {
                            if (isPremium) {
                              navigation.getParent()?.navigate("QuizTab", {
                                screen: "QuizSetup",
                                params: { topicId: link.topicId! },
                              });
                            } else {
                              navigation.getParent()?.navigate("ProfileTab", {
                                screen: "Subscription",
                              });
                            }
                          }}
                          style={{ marginTop: 10 }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? colors.brand[400] : colors.brand[600] }}>
                            {isPremium
                              ? `Ćwicz ten dział — ${link.questionCount} pytań z „${link.topicName}” →`
                              : `W Premium: ${link.questionCount} pytań z działu „${link.topicName}” →`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </Card>
                ))}
              </>
            )}

            {/* Co dalej — konto bez Premium: darmowa próbka quizu (diagnoza,
                raz na konto) + odblokowanie; Premium: powtórka arkusza. */}
            <View
              style={{
                marginTop: 16,
                paddingTop: 18,
                borderTopWidth: 1,
                borderTopColor: theme.borderLight,
              }}
            >
              {isPremium === false ? (
                <>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text, textAlign: "center", marginBottom: 12 }}>
                    Co dalej?
                  </Text>
                  {diagCard.kind !== "none" && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        navigation.getParent()?.navigate("HomeTab", { screen: "Diagnosis" })
                      }
                      style={{
                        padding: 16,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                        backgroundColor: theme.card,
                        marginBottom: 12,
                      }}
                    >
                      <View
                        style={{
                          alignSelf: "flex-start",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 99,
                          backgroundColor: isDark ? "#064e3b55" : "#d1fae5",
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "800", color: isDark ? "#6ee7b7" : "#065f46", letterSpacing: 0.6 }}>
                          ZA DARMO
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>
                        {diagCard.kind === "progress"
                          ? `Dokończ darmową próbkę quizu — ${diagCard.name}`
                          : "Darmowa próbka quizu"}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }}>
                        Sprawdź drugi tryb nauki: 13 pytań jak w Quizie, z oceną i krótkim wyjaśnieniem po każdej odpowiedzi. Raz na konto.
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View
                    style={{
                      padding: 18,
                      borderRadius: 18,
                      backgroundColor: isDark ? colors.brand[900] + "33" : colors.brand[50],
                      borderWidth: 1,
                      borderColor: isDark ? colors.brand[700] + "80" : colors.brand[300],
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
                      {summaryWithheld
                        ? "Rozwiąż cały arkusz, żeby zobaczyć, gdzie tracisz punkty"
                        : framing.upsellTitle}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.textSecondary,
                        lineHeight: 19,
                        marginTop: 6,
                        marginBottom: 14,
                      }}
                    >
                      {summaryWithheld
                        ? "Omówienie, plan naprawczy i rozwiązania wszystkich zadań pojawiają się przy pełnym podejściu. W Premium masz wszystkie arkusze i możesz podchodzić do nich wielokrotnie."
                        : framing.upsellBody}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        navigation.getParent()?.navigate("ProfileTab", {
                          screen: "Subscription",
                        })
                      }
                      style={{
                        backgroundColor: colors.brand[500],
                        borderRadius: 16,
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}
                      >
                        Odblokuj wszystkie arkusze →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : isPremium ? (
                <TouchableOpacity
                  onPress={() => setShowRetryModal(true)}
                  style={{
                    alignItems: "center",
                    alignSelf: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderRadius: 16,
                    backgroundColor: theme.inputBg,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textSecondary }}>
                    🔄 Rozwiąż ponownie od zera
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.textTertiary, marginTop: 4 }}>
                    Obecne wyniki zostaną zastąpione nowymi.
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* ── TASK REVIEW ── */}
        {!isSummary && currentTask && currentGrading && (() => {
          const tone = currentGrading.isCorrect
            ? "ok"
            : currentGrading.pointsEarned > 0
              ? "partial"
              : "bad";
          const toneSolid = tone === "ok" ? colors.brand[500] : tone === "partial" ? "#f59e0b" : "#ef4444";
          const toneText =
            tone === "ok"
              ? isDark ? "#4ade80" : "#16a34a"
              : tone === "partial"
                ? isDark ? "#fbbf24" : "#d97706"
                : isDark ? "#f87171" : "#dc2626";
          // Karta zadania w kolorze oceny, jak web (border + delikatne tło).
          const cardBorder =
            tone === "ok"
              ? isDark ? "#14532d" : "#bbf7d0"
              : tone === "partial"
                ? isDark ? "#78350f" : "#fde68a"
                : isDark ? "#7f1d1d" : "#fecaca";
          const cardBg =
            tone === "ok"
              ? isDark ? "#22c55e0d" : "#f0fdf4"
              : tone === "partial"
                ? isDark ? "#f59e0b0d" : "#fffbeb"
                : isDark ? "#ef44440d" : "#fef2f2";
          const typeLabel = examTaskTypeLabel(currentTask.type);
          return (
          <View>
            {currentPart && (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.text,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.borderLight,
                }}
              >
                {examPartName(currentPart.name)}
              </Text>
            )}

            {/* Materiały źródłowe — domyślnie widoczne; szukane w całym arkuszu. */}
            {currentTask.materialIds?.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowMaterials(!showMaterials)}
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 14,
                  backgroundColor: isDark ? "#92400e33" : "#fef3c7",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isDark ? "#fbbf24" : "#b45309",
                  }}
                >
                  📄 {showMaterials ? "Ukryj materiały źródłowe" : "Pokaż materiały źródłowe"}
                </Text>
              </TouchableOpacity>
            )}
            {showMaterials &&
              (currentTask.materialIds || []).map((matId: string) => {
                const mat = allMaterials.find((m: any) => m.id === matId);
                if (!mat) return null;
                // Pełny renderer materiałów (ten sam co w playerze): tabele,
                // SVG, wykresy.
                return (
                  <MaterialRenderer
                    key={mat.id}
                    mat={mat}
                    theme={theme}
                    isDark={isDark}
                  />
                );
              })}

            {/* Karta zadania z oceną */}
            <View
              style={{
                borderRadius: 20,
                borderWidth: 2,
                borderColor: cardBorder,
                backgroundColor: cardBg,
                padding: 16,
              }}
            >
              {/* Nagłówek: numer w kolorze oceny, typ • punkty, zgłoś, wynik */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    minWidth: 32,
                    height: 32,
                    paddingHorizontal: 6,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: toneSolid,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
                    {labelOf(currentTask)}
                  </Text>
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 11,
                    color: theme.textTertiary,
                    flex: 1,
                    letterSpacing: 0.4,
                  }}
                >
                  {typeLabel ? `${typeLabel.toUpperCase()} • ` : ""}
                  {currentTask.points} PKT
                </Text>
                {/* W wynikach najczęściej widać, że klucz albo ocena są złe. */}
                {exam?.id && (
                  <ReportButton
                    exam={{
                      examId: exam.id,
                      taskId: currentTask.id,
                      taskLabel: labelOf(currentTask),
                    }}
                    questionPreview={String(currentTask.instruction ?? "")}
                  />
                )}
                <Text style={{ fontSize: 15, fontWeight: "800", color: toneText }}>
                  {currentGrading.pointsEarned}/{currentGrading.maxPoints} pkt
                </Text>
              </View>

              {/* Polecenie — CodeAwareText jak w playerze: płoty ```kodu
                  i `kod w linii` (informatyka) zamiast gołych backticków. */}
              <CodeAwareText
                text={cleanInstructionForDisplay(currentTask)}
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: theme.text,
                  lineHeight: 24,
                }}
                containerStyle={{ marginBottom: 16 }}
                isDark={isDark}
              />

              {/* Tabela w poleceniu (task.content.table) — jak web ExamResults. */}
              {Array.isArray(currentTask.content?.table?.headers) &&
                Array.isArray(currentTask.content?.table?.rows) && (
                  <View style={{ marginBottom: 16 }}>
                    <StructTableView
                      table={currentTask.content.table}
                      theme={theme}
                      isDark={isDark}
                    />
                  </View>
                )}

              {/* Twoja odpowiedź — w formie zadania (ABCD, P/F, dopasowanie)
                  z zaznaczonym kluczem, jak web AnswerDisplay. */}
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: theme.textTertiary,
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  TWOJA ODPOWIEDŹ:
                </Text>
                <AnswerDisplay task={currentTask} tg={currentGrading} theme={theme} isDark={isDark} />
              </View>

              {/* Analiza AI */}
              {((currentGrading.analysis?.correct ?? []).length > 0 ||
                (currentGrading.analysis?.incorrect ?? []).length > 0 ||
                (currentGrading.analysis?.missing ?? []).length > 0) && (
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  {[
                    { items: currentGrading.analysis?.correct ?? [], mark: "✓", color: colors.brand[500] },
                    { items: currentGrading.analysis?.incorrect ?? [], mark: "✗", color: "#ef4444" },
                    { items: currentGrading.analysis?.missing ?? [], mark: "!", color: "#f59e0b" },
                  ].map((g, gi) =>
                    g.items.map((c: string, i: number) => (
                      <View key={`${gi}-${i}`} style={{ flexDirection: "row", gap: 8, marginBottom: 5 }}>
                        <Text style={{ color: g.color, fontWeight: "800", fontSize: 13 }}>{g.mark}</Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, flex: 1, lineHeight: 19 }}>
                          {c}
                        </Text>
                      </View>
                    )),
                  )}
                  {currentGrading.analysis?.suggestion ? (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: theme.border,
                        paddingTop: 8,
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: isDark ? "#38bdf8" : "#0284c7", lineHeight: 19 }}>
                        💡 {currentGrading.analysis.suggestion}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Zadanie czeka na ocenę AI */}
              {(currentGrading as any)?._ungraded && (
                <View
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? "#5b21b61a" : "#faf5ff",
                    borderWidth: 1,
                    borderColor: isDark ? "#6b21a8" : "#e9d5ff",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#c084fc" : "#7c3aed" }}>
                    🤖 To zadanie wymaga oceny AI
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, textAlign: "center", lineHeight: 17 }}>
                    Dotknij „Oceń z AI” w podsumowaniu, aby uzyskać pełną ocenę z feedbackiem CKE.
                  </Text>
                </View>
              )}

              {/* Kryteria CKE */}
              {currentGrading.criteria?.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: theme.textTertiary,
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    KRYTERIA CKE:
                  </Text>
                  {currentGrading.criteria.map((cr: any, i: number) => (
                    <View
                      key={i}
                      style={{
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.85)",
                        borderRadius: 10,
                        padding: 10,
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 2,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: theme.text }}>
                          {cr.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color:
                              cr.score >= cr.maxScore * 0.7
                                ? isDark ? "#4ade80" : "#16a34a"
                                : cr.score > 0
                                  ? isDark ? "#fbbf24" : "#d97706"
                                  : isDark ? "#f87171" : "#dc2626",
                          }}
                        >
                          {cr.score}/{cr.maxScore}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17 }}>
                        {cr.feedback}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Wzorcowa odpowiedź — tabele Markdown jako tabele (TextWithTables). */}
              {currentGrading.modelAnswer ? (
                <View
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: isDark ? "#064e3b40" : "#ecfdf5",
                    borderWidth: 1,
                    borderColor: isDark ? "#065f46" : "#a7f3d0",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: isDark ? "#34d399" : "#059669",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    📝 WZORCOWA ODPOWIEDŹ
                  </Text>
                  <TextWithTables
                    text={currentGrading.modelAnswer}
                    style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}
                    theme={theme}
                    isDark={isDark}
                  />
                </View>
              ) : null}
            </View>
          </View>
          );
        })()}
      </ScrollView>

      {/* ═══ BOTTOM NAV ═══ Na podsumowaniu arkusza konta bez Premium ukryta —
          rozpraszała przed kupnem (web, Karol 28.09.2026); zadania są pod
          ikoną listy u góry. Premium bez zmian. */}
      {!(isSummary && isPremium === false) && (
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.borderLight,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={goPrev}
          style={{ paddingVertical: 10, paddingHorizontal: 6, flexShrink: 1 }}
        >
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, fontWeight: "600", color: theme.textSecondary }}
          >
            ←{" "}
            {isSummary
              ? "Ostatnie zadanie"
              : currentIndex === 0
                ? "Podsumowanie"
                : "Poprzednie"}
          </Text>
        </TouchableOpacity>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 12,
            color: theme.textTertiary,
          }}
        >
          {isSummary ? "" : `${currentIndex + 1} / ${allTasks.length}`}
        </Text>
        <Button
          title={
            isSummary
              ? "Zadanie 1 →"
              : currentIndex === allTasks.length - 1
                ? "Podsumowanie →"
                : "Następne →"
          }
          onPress={goNext}
          size="sm"
        />
      </View>
      )}
    </View>
  );
}

// ═══ Twoja odpowiedź w formie zadania — lustro web AnswerDisplay ═══
// ABCD: opcje z kluczem (zielona ramka) i Twoim błędnym wyborem (czerwona);
// P/F: każde stwierdzenie z Twoim P/F i poprawką; dopasowanie: pary z kluczem.
// Kolory tła w ciemnym motywie z przezroczystością, tekst zawsze theme.text —
// wcześniej jasne pola z jasnym tekstem były nieczytelne.

function toOptionList(v: any): { id: string; text: string }[] {
  if (Array.isArray(v)) return v.map((o: any) => (typeof o === "object" ? o : { id: String(o), text: String(o) }));
  if (v && typeof v === "object")
    return Object.entries(v).map(([id, text]) =>
      text && typeof text === "object" ? { id, ...(text as any) } : { id, text: String(text) },
    );
  return [];
}

function AnswerDisplay({
  task,
  tg,
  theme,
  isDark,
}: {
  task: any;
  tg: any;
  theme: any;
  isDark: boolean;
}) {
  const r = tg?.userResponse;
  const c = task?.content ?? {};
  const okBg = isDark ? "rgba(34,197,94,0.16)" : "#f0fdf4";
  const okBorder = isDark ? "#22c55e" : "#4ade80";
  const badBg = isDark ? "rgba(239,68,68,0.16)" : "#fef2f2";
  const badBorder = isDark ? "#ef4444" : "#f87171";
  const neutralBg = isDark ? "rgba(255,255,255,0.05)" : "#fafafa";
  const okText = isDark ? "#4ade80" : "#16a34a";
  const badText = isDark ? "#f87171" : "#dc2626";
  const chipOff = isDark ? "rgba(255,255,255,0.12)" : "#e4e4e7";

  // Tekst z lukami — Twoje wpisy w zdaniu (zielone/czerwone) + klucz.
  if (isGapTextType(task?.type)) {
    return <GapTextReview task={task} response={r} theme={theme} isDark={isDark} />;
  }

  // P/F — stwierdzenia z kluczem isTrue i odpowiedź jako tablica booleanów.
  const stmts: any[] = Array.isArray(c.statements) ? c.statements : [];
  if (stmts.length > 0 && stmts.every((st) => typeof st?.isTrue === "boolean") && (Array.isArray(r) || r == null)) {
    const ans = Array.isArray(r) ? r : [];
    return (
      <View style={{ gap: 6 }}>
        {stmts.map((st: any, i: number) => {
          const ua = ans[i];
          const ok = ua === st.isTrue;
          return (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 10,
                borderRadius: 12,
                backgroundColor: ok ? okBg : badBg,
              }}
            >
              <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 19 }}>
                {parseChemText(String(st.text ?? ""))}
              </Text>
              {(["P", "F"] as const).map((l) => {
                const sel = l === "P" ? ua === true : ua === false;
                return (
                  <View
                    key={l}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      backgroundColor: sel ? (ok ? colors.brand[500] : "#ef4444") : chipOff,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: sel ? "#fff" : theme.textSecondary }}>
                      {l}
                    </Text>
                  </View>
                );
              })}
              {!ok && (
                <Text style={{ fontSize: 12, fontWeight: "800", color: okText }}>
                  → {st.isTrue ? "P" : "F"}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // ABCD — opcje + correctAnswer (bez wariantu złożonego „A2”).
  const opts = toOptionList(c.options);
  if (opts.length > 0 && !Array.isArray(c.leftOptions) && (typeof r === "string" || r == null)) {
    const correct = c.correctAnswer;
    // Bez klucza w treści (wstrzymany przy braku odpowiedzi) nie oznaczamy
    // wyboru jako błędu — tylko zaznaczenie.
    const noKey = correct == null;
    return (
      <View style={{ gap: 6 }}>
        {opts.map((o) => {
          const sel = r === o.id;
          const isC = correct != null && o.id === correct;
          return (
            <View
              key={o.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 10,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isC ? okBorder : sel ? (noKey ? colors.navy[400] : badBorder) : "transparent",
                backgroundColor: isC ? okBg : sel && !noKey ? badBg : neutralBg,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isC ? colors.brand[500] : sel ? (noKey ? colors.navy[500] : "#ef4444") : chipOff,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: isC || sel ? "#fff" : theme.textSecondary }}>
                  {o.id}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 19 }}>
                {parseChemText(String(o.text ?? ""))}
              </Text>
              {isC && <Text style={{ fontSize: 14, fontWeight: "800", color: okText }}>✓</Text>}
              {sel && !isC && !noKey && <Text style={{ fontSize: 14, fontWeight: "800", color: badText }}>✗</Text>}
            </View>
          );
        })}
      </View>
    );
  }

  // Dopasowanie — correctPairs {lewy: prawy}.
  if (c.correctPairs && typeof c.correctPairs === "object" && !Array.isArray(c.correctPairs)) {
    const up = r && typeof r === "object" && !Array.isArray(r) ? r : {};
    const left: any[] = Array.isArray(c.leftItems) ? c.leftItems : [];
    return (
      <View style={{ gap: 6 }}>
        {Object.entries(c.correctPairs).map(([l, right]: [string, any]) => {
          const ur = (up as any)[l];
          const ok = String(ur ?? "") === String(right);
          const li = left.find((x: any) => x?.id === l);
          return (
            <View
              key={l}
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 6,
                padding: 10,
                borderRadius: 12,
                backgroundColor: ok ? okBg : badBg,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: theme.text }}>{l}.</Text>
              <Text style={{ flex: 1, minWidth: 120, fontSize: 13, color: theme.text, lineHeight: 19 }}>
                {parseChemText(String(li?.text ?? l))}
              </Text>
              <Text style={{ fontSize: 13, color: theme.textTertiary }}>→</Text>
              {ok ? (
                <Text style={{ fontSize: 13, fontWeight: "800", color: okText }}>{String(right)}</Text>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: badText, textDecorationLine: "line-through" }}>
                    {ur ? String(ur) : "—"}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: okText }}>→ {String(right)}</Text>
                </>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // Wypowiedź pisemna / wypracowanie / notatka — tekst z liczbą słów.
  const writingText =
    typeof r === "string"
      ? r
      : r && typeof r === "object" && !Array.isArray(r)
        ? String(r.text ?? r.writing ?? r.content ?? "")
        : "";
  const topic = r && typeof r === "object" && !Array.isArray(r) ? r.topic ?? r.chosen_topic ?? null : null;
  const isWriting = /wypracowanie|notatka|writing|essay/.test(String(task?.type ?? ""));
  if (isWriting) {
    const wc = writingText.trim() ? writingText.trim().split(/\s+/).length : 0;
    return (
      <View>
        {topic ? (
          <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? colors.navy[300] : colors.navy[600], marginBottom: 6 }}>
            Wybrany temat: {String(topic)}
          </Text>
        ) : null}
        <View
          style={{
            backgroundColor: theme.inputBg,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ fontSize: 13, color: writingText ? theme.text : theme.textTertiary, lineHeight: 20, fontStyle: writingText ? "normal" : "italic" }}>
            {writingText || "Brak"}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 4, textAlign: "right" }}>
          {wc} słów
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: theme.inputBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontSize: 13, color: hasResponse(r) ? theme.text : theme.textTertiary, lineHeight: 20 }}>
        {parseChemText(formatUserResponse(r))}
      </Text>
    </View>
  );
}

function formatUserResponse(r: any): string {
  if (r === null || r === undefined) return "Brak odpowiedzi";
  if (typeof r === "string") return r || "Brak odpowiedzi";
  if (typeof r === "object" && r.text) return r.text;
  if (Array.isArray(r))
    return r
      .map((v, i) => `${i + 1}. ${v === true ? "P" : v === false ? "F" : v}`)
      .join("\n");
  if (typeof r === "object")
    return Object.entries(r)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  return String(r);
}
