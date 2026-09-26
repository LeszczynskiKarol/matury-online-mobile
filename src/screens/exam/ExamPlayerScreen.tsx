// src/screens/exam/ExamPlayerScreen.tsx

// ============================================================================
// ExamPlayerScreen — Main exam interface (mobile version of ExamPlayer.tsx)
// ============================================================================
import { MathGraph } from "../../components/quiz/MathGraph";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { stopAllListeningPlayers } from "../../hooks/useListeningPlayer";
import { MathEditor } from "../../components/exam/MathEditor";
import {
  isGermanTaskType,
  GermanTaskRenderer,
} from "../../components/exam/NiemieckiTaskRenderers";
import {
  isTier2TaskType,
  Tier2TaskRenderer,
} from "../../components/exam/Tier2TaskRenderers";
import { MaterialRenderer } from "../../components/exam/MaterialRenderer";
import { SectionErrorBoundary } from "../../components/exam/SectionErrorBoundary";
import { normalizeEnglishContent } from "../../utils/normalizeEnglishContent";
import { SvgViewer } from "../../components/exam/SvgViewer";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OptionCard } from "../../components/quiz/OptionCard";
import { cleanInstructionForDisplay } from "../../utils/examInstruction";
import { parseChemText } from "../../utils/chemText";
import { CodeAwareText } from "../../components/common/CodeAwareText";
import {
  startExam,
  saveExamAnswers,
  submitExam,
  discardExam,
  estimateExam,
  type ExamStartData,
} from "../../api/exams";
import {
  AdminCopyBar,
  AdminCopyButton,
} from "../../components/common/AdminCopyButton";
import type { ExamStackParamList } from "../../navigation/types";
import { handlePremiumError } from "../../lib/premiumAlert";
import { tableColWidths } from "../../lib/tableWidths";
import { ReportButton } from "../../components/quiz/ReportQuestion";

type Nav = NativeStackNavigationProp<ExamStackParamList>;

// ══════════════════════════════════════════════════════════════════════════

// Jak answerIsNonEmpty w backendzie (routes/exam-live.ts).
function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(isFilled);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("text" in o || "writing" in o || "content" in o)
      return isFilled(o.text ?? o.writing ?? o.content);
    return Object.values(o).some(isFilled);
  }
  return true;
}

// Część arkuszy (np. bio_abcd) trzyma opcje jako mapę {"A": "…", "B": "…"},
// a renderery apki robią `options.map` — zadanie wywalało się z „Nie udało
// się wyświetlić: treść zadania” (26.09.2026). Web ma renderery tolerujące
// oba kształty; tu prostujemy dane raz, przy wczytaniu arkusza.
const OPTION_KEYS = ["options", "answerOptions", "justificationOptions", "justifications"];
function toOptionList(v: any): any {
  if (!v || Array.isArray(v) || typeof v !== "object") return v;
  return Object.entries(v).map(([id, text]) =>
    text && typeof text === "object" ? { id, ...(text as object) } : { id, text },
  );
}
function normalizeOptionMaps<T extends { exam: { content: { parts: any[] } } }>(d: T): T {
  for (const part of d?.exam?.content?.parts ?? []) {
    for (const task of part?.tasks ?? []) {
      for (const holder of [task, task?.content]) {
        if (!holder || typeof holder !== "object") continue;
        for (const key of OPTION_KEYS) {
          if (key in holder) holder[key] = toOptionList(holder[key]);
        }
      }
    }
  }
  return d;
}

export function ExamPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  // `attempt` = nonce z zadania korepetytora: ten sam examId otwarty drugi
  // raz (np. po błędzie dostępu) ma zrobić świeży start, a nie pokazywać
  // zapamiętany stan ekranu, który został w stosie ExamTab.
  const { examId, attempt } = route.params as { examId: string; attempt?: number };

  const scrollRef = useRef<ScrollView>(null);

  // ── State ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"loading" | "exam" | "submitting">(
    "loading",
  );
  const [data, setData] = useState<ExamStartData | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentTaskId, setCurrentTaskId] = useState("");

  // Nagranie należy do zadania: przejście do poprzedniego/następnego ucisza
  // wszystko, co gra. Bez tego narrator z zadania 1 leciał pod zadaniem 2,
  // a kolejne PLAY nakładało na niego drugi głos. Sprzątanie przy
  // odmontowaniu obsługuje wyjście z egzaminu.
  useEffect(() => {
    stopAllListeningPlayers();
    return () => stopAllListeningPlayers();
  }, [currentTaskId]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [timeUpModal, setTimeUpModal] = useState(false);
  // Wycena oceny AI dla bieżących odpowiedzi (modal „Zakończ i sprawdź”).
  const [estimate, setEstimate] = useState<{
    credits: number;
    remaining: number;
    enough: boolean;
  } | null>(null);
  const [timeUpSubmitting, setTimeUpSubmitting] = useState(false);
  const handleSubmitRef = useRef<(() => void) | null>(null);
  const [showNav, setShowNav] = useState(false);
  // Ekran przed pierwszym zadaniem darmowego arkusza (jak na webie): co to
  // jest, ile zajmuje, że nie ma zegara i od której części zacząć. Wraca
  // z „← Części arkusza" jako przegląd części z postępem.
  const [showIntro, setShowIntro] = useState(false);
  // Materiały (teksty źródłowe, mapy, wykresy) domyślnie ROZWINIĘTE — tak jak
  // w wersji webowej. Zwinięte na starcie zmuszały do klikania „Pokaż teksty"
  // przy każdym zadaniu z osobna, a bez materiału większości poleceń nie da
  // się nawet przeczytać ze zrozumieniem.
  const [showMaterials, setShowMaterials] = useState(true);

  const examStartedAtRef = useRef(0);
  const totalTimeMsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Zapis stanu: refy trzymają aktualne answers/currentTaskId, żeby interval
  // autosave'u NIE miał ich w zależnościach efektu — wcześniej każda
  // odpowiedź robiła clearInterval+setInterval i licznik 30 s nigdy nie
  // dobiegał końca u aktywnie odpowiadającego ucznia (realna utrata
  // odpowiedzi; ten sam bug naprawiono na webie w b9e81a7).
  const answersRef = useRef<Record<string, any>>({});
  const currentTaskIdRef = useRef<string>("");
  const dataRef = useRef<ExamStartData | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // ── Load exam ──────────────────────────────────────────────────────
  useEffect(() => {
    setError(null);
    (async () => {
      try {
        const examData = normalizeOptionMaps(await startExam(examId));
        setData(examData);
        setAnswers(examData.savedAnswers || {});
        if (
          (examData as any).untimed &&
          Object.keys(examData.savedAnswers || {}).length === 0
        ) {
          setShowIntro(true);
        }

        const allTasks = examData.exam.content.parts.flatMap(
          (p: any) => p.tasks,
        );
        setCurrentTaskId(examData.currentTaskId || allTasks[0]?.id || "");

        examStartedAtRef.current = new Date(examData.startedAt).getTime();
        totalTimeMsRef.current = examData.exam.timeMinutes * 60 * 1000;
        setRemainingMs(
          Math.max(
            0,
            totalTimeMsRef.current - (Date.now() - examStartedAtRef.current),
          ),
        );
        setPhase("exam");
      } catch (err: any) {
        // Arkusz już oddany (np. oddał się sam po czasie albo na webie) —
        // prosto do wyniku zamiast ekranu błędu.
        if (err?.status === 409 && err?.data?.attemptId) {
          navigation.replace("ExamResults", { attemptId: err.data.attemptId });
          return;
        }
        setError(err.message || "Nie udało się rozpocząć egzaminu.");
      }
    })();
  }, [examId, attempt]);

  // ── Timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    timerRef.current = setInterval(() => {
      const r = Math.max(
        0,
        totalTimeMsRef.current - (Date.now() - examStartedAtRef.current),
      );
      setRemainingMs(r);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // Time up
  useEffect(() => {
    // Arkusz z darmowej oferty (untimed) nie ma czego kończyć.
    if (!data?.untimed && remainingMs <= 0 && phase === "exam" && data) {
      // Koniec czasu → arkusz oddaje się sam (bez wyboru trybu oceny;
      // pusty jest porzucany).
      setTimeUpSubmitting(true);
      handleSubmitRef.current?.();
    }
  }, [remainingMs, phase]);

  // Refy synchronizowane przy każdym renderze — saveNow zawsze widzi świeży stan
  answersRef.current = answers;
  currentTaskIdRef.current = currentTaskId;
  dataRef.current = data;

  // ── Zapis odpowiedzi ───────────────────────────────────────────────
  const saveNow = useCallback(() => {
    const d = dataRef.current;
    if (!d) return;
    saveExamAnswers(d.attemptId, {
      answers: answersRef.current,
      currentTaskId: currentTaskIdRef.current || undefined,
      // Czas trwania: wall-clock od startu PODEJŚCIA (nie od otwarcia
      // ekranu) — inaczej każde wznowienie zerowało czas w statystykach.
      timeSpentMs: Date.now() - examStartedAtRef.current,
    })
      .then(() => {
        setLastSavedAt(new Date());
        setSaveFailed(false);
      })
      .catch(() => setSaveFailed(true));
  }, []);

  // ── Autosave every 30s ─────────────────────────────────────────────
  // Zależności celowo BEZ answers/currentTaskId (są w refach) — interval
  // musi tykać niezależnie od odpowiadania.
  useEffect(() => {
    if (phase !== "exam" || !data) return;
    autosaveRef.current = setInterval(() => saveNow(), 30000);
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [phase, data, saveNow]);

  // ── Zapis przy zejściu w tło ───────────────────────────────────────
  // Android zamraża timery JS w tle, a system może ubić proces — moment
  // przejścia w background to ostatnia szansa na zapis (mobilny odpowiednik
  // visibilitychange/pagehide z weba).
  useEffect(() => {
    if (phase !== "exam" || !data) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") saveNow();
    });
    return () => sub.remove();
  }, [phase, data, saveNow]);

  // ── Zapis przy wyjściu z ekranu (back / gest / nawigacja) ──────────
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      if (dataRef.current) saveNow();
    });
    return unsub;
  }, [navigation, saveNow]);

  // ── Derived ────────────────────────────────────────────────────────
  const allTasks = useMemo(
    () =>
      data?.exam.content.parts.flatMap((p: any) =>
        p.tasks.map((t: any) => ({ ...t, partId: p.id, partName: p.name })),
      ) || [],
    [data],
  );

  const currentTask = allTasks.find((t: any) => t.id === currentTaskId);
  const currentPart = data?.exam.content.parts.find((p: any) =>
    p.tasks.some((t: any) => t.id === currentTaskId),
  );
  const currentIndex = allTasks.findIndex((t: any) => t.id === currentTaskId);

  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  // Arkusz z darmowej oferty nie ma zegara (backend: flaga `untimed`) —
  // timer liczył się od startedAt także poza apką, więc kto nie miał od razu
  // 170 minut, tracił jedyne darmowe podejście.
  const untimed = !!data?.untimed;
  const isWarning = !untimed && remainingMs < 15 * 60000;
  const isCritical = !untimed && remainingMs < 5 * 60000;

  // Jak answerIsNonEmpty w backendzie: temat bez tekstu czy mapa pustych
  // luk to wciąż brak odpowiedzi.
  const answeredCount = allTasks.filter((t: any) => isFilled(answers[t.id])).length;
  const openAnswered = allTasks.filter(
    (t: any) => t.gradingType !== "deterministic" && isFilled(answers[t.id]),
  ).length;

  // ── Helpers ────────────────────────────────────────────────────────
  const setAnswer = useCallback((taskId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [taskId]: value }));
  }, []);

  const goToTask = useCallback(
    (id: string) => {
      setCurrentTaskId(id);
      setShowNav(false);
      // Świadomie NIE zwijamy materiałów przy zmianie zadania — kolejne
      // polecenia zwykle dotyczą tego samego tekstu źródłowego.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      // Nawigacja między zadaniami = naturalny checkpoint zapisu
      saveNow();
    },
    [saveNow],
  );

  const goNext = useCallback(() => {
    if (currentIndex < allTasks.length - 1)
      goToTask(allTasks[currentIndex + 1].id);
  }, [currentIndex, allTasks, goToTask]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goToTask(allTasks[currentIndex - 1].id);
  }, [currentIndex, allTasks, goToTask]);

  // ── Submit ─────────────────────────────────────────────────────────
  // Porzucenie: arkusz wraca na listę do rozwiązania, bez wyniku i kredytów.
  const discardAttempt = useCallback(async () => {
    if (!data) return;
    setConfirmModal(false);
    setPhase("submitting");
    try {
      await discardExam(data.attemptId);
    } catch {}
    navigation.replace("ExamSelector", { noAutoOpen: true });
  }, [data, navigation]);

  // „Zakończ i sprawdź” — zamknięte od razu, otwarte ocenia AI automatycznie
  // (bez kredytów backend oddaje wynik częściowy). `skipAi` zostaje w
  // sygnaturze tylko dla zgodności — nowy UI go nie używa.
  const handleSubmit = useCallback(
    async (skipAi: boolean = false) => {
      if (!data) return;
      if (answeredCount === 0) {
        discardAttempt();
        return;
      }
      setPhase("submitting");
      setConfirmModal(false);
      setTimeUpModal(false);
      try {
        const res = await submitExam(data.attemptId, {
          answers,
          timeSpentMs: Date.now() - examStartedAtRef.current,
          timeLeftMs: remainingMs,
          skipAiGrading: skipAi || undefined,
          discardIfEmpty: true,
        });
        if (res?.status === "ABANDONED") {
          navigation.replace("ExamSelector", { noAutoOpen: true });
          return;
        }
        navigation.replace("ExamResults", { attemptId: data.attemptId });
      } catch (err: any) {
        if (handlePremiumError(err, navigation)) return;
        Alert.alert("Błąd", err.message || "Nie udało się przesłać egzaminu.");
        setPhase("exam");
      }
    },
    [data, answers, remainingMs, navigation, answeredCount, discardAttempt],
  );
  handleSubmitRef.current = () => handleSubmit(false);

  const openConfirm = useCallback(() => {
    setConfirmModal(true);
    setEstimate(null);
    if (!data || answeredCount === 0) return;
    estimateExam(data.attemptId, answers)
      .then((e) => setEstimate(e))
      .catch(() => {});
  }, [data, answers, answeredCount]);

  // ── Error / Loading ────────────────────────────────────────────────
  if (error) {
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

  if (phase === "loading") {
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
          Ładowanie egzaminu...
        </Text>
      </View>
    );
  }

  if (phase === "submitting") {
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
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: theme.text,
            marginTop: 16,
          }}
        >
          {timeUpSubmitting ? "Czas minął — oddaję arkusz…" : "Przesyłanie egzaminu..."}
        </Text>
      </View>
    );
  }

  if (!data || !currentTask) return null;

  // ── Ekran przed startem / przegląd części (darmowy arkusz) ─────────
  if (showIntro) {
    const parts: any[] = data.exam.content.parts.filter((p: any) => p.tasks?.length > 0);
    const isAns = (id: string) => {
      const a = answers[id];
      if (a === null || a === undefined) return false;
      if (typeof a === "string") return a.trim().length > 0;
      if (typeof a === "object") return Object.keys(a).length > 0;
      return true;
    };
    const started = answeredCount > 0;
    // „Rozumienie tekstów pisanych" to czytanie, nie pisanie — stąd kolejność.
    const kindOf = (name: string) =>
      /słuch|listening/i.test(name)
        ? "listening"
        : /czyta|tekst|reading/i.test(name)
          ? "reading"
          : /pisemn|wypowied|wypracowan|writing|rozprawk/i.test(name)
            ? "writing"
            : "other";
    const icon = (name: string) =>
      ({ listening: "🎧", reading: "📖", writing: "✍️", other: "📝" } as Record<string, string>)[kindOf(name)];
    const shortest = parts
      .filter((p) => kindOf(p.name) !== "writing")
      .reduce((m: any, p: any) => (!m || p.tasks.length < m.tasks.length ? p : m), null);
    const startAt = (part: any) => {
      const t = part.tasks.find((x: any) => !isAns(x.id)) ?? part.tasks[0];
      setCurrentTaskId(t.id);
      setShowIntro(false);
    };
    const zadan = (n: number) => (n === 1 ? "zadanie" : n < 5 ? "zadania" : "zadań");
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 60 }}
      >
        <Text style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: "800", color: colors.brand[500], backgroundColor: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
          {started ? `DARMOWY ARKUSZ TESTOWY · ROZWIĄZANE ${answeredCount}/${allTasks.length}` : "DARMOWY ARKUSZ TESTOWY"}
        </Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: theme.text, marginBottom: 8 }}>
          {data.exam.title}
        </Text>
        <Text style={{ fontSize: 15, color: theme.textSecondary, lineHeight: 22, marginBottom: 16 }}>
          {allTasks.length} {zadan(allTasks.length)} w {parts.length} {parts.length === 1 ? "części" : "częściach"}, {data.exam.maxPoints} pkt — tak jak na egzaminie. Na sali to {data.exam.timeMinutes} min, ale ten arkusz{" "}
          <Text style={{ fontWeight: "800", color: theme.text }}>nie ma limitu czasu</Text>.
        </Text>
        {!started && (
          <View style={{ gap: 8, marginBottom: 22 }}>
            <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>⏸ Możesz rozwiązywać na raty — wyjdź w dowolnym momencie, odpowiedzi zapisują się same.</Text>
            <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>🧭 Zadania rozwiązujesz w dowolnej kolejności — lista wszystkich jest pod przyciskiem ☰.</Text>
            <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>✅ Oddać możesz w każdej chwili — zobaczysz wynik z rozwiązanych zadań, i z całego arkusza, z oceną AI.</Text>
          </View>
        )}
        <Text style={{ fontSize: 12, fontWeight: "700", color: theme.textSecondary, letterSpacing: 1, marginBottom: 10 }}>
          {started ? "PRZEJDŹ DO CZĘŚCI" : "OD CZEGO CHCESZ ZACZĄĆ?"}
        </Text>
        {parts.map((part: any) => (
          <TouchableOpacity
            key={part.id}
            onPress={() => startAt(part)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, marginBottom: 8 }}
          >
            <Text style={{ fontSize: 24 }}>{icon(part.name)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{part.name}</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                {part.tasks.length} {zadan(part.tasks.length)}
                {part.maxPoints ? ` · ${part.maxPoints} pkt` : ""}
                {started ? ` · rozwiązane ${part.tasks.filter((t: any) => isAns(t.id)).length}/${part.tasks.length}` : ""}
              </Text>
              {!started && shortest?.id === part.id && parts.length > 1 && (
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand[500], marginTop: 3 }}>dobry na start</Text>
              )}
            </View>
            <Text style={{ fontSize: 16, color: theme.textSecondary }}>→</Text>
          </TouchableOpacity>
        ))}
        <View style={{ marginTop: 12 }}>
          <Button
            title={started ? `Wróć do zadania ${currentTask.number} →` : "Zaczynam od początku →"}
            onPress={() => (started ? setShowIntro(false) : parts[0] && startAt(parts[0]))}
          />
        </View>
      </ScrollView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ═══ ZAKOŃCZ I SPRAWDŹ ═══ */}
      <Modal visible={confirmModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 24,
              padding: 26,
              width: "100%",
              maxWidth: 380,
            }}
          >
            {answeredCount === 0 ? (
              <>
                <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>📄</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text, textAlign: "center", marginBottom: 8 }}>
                  Nie masz jeszcze żadnej odpowiedzi
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center", marginBottom: 20, lineHeight: 19 }}>
                  Pusty arkusz nie ma czego ocenić. Możesz wrócić do zadań albo porzucić arkusz — wróci na listę do rozwiązania, bez wyniku.
                </Text>
                <TouchableOpacity
                  onPress={() => setConfirmModal(false)}
                  style={{ backgroundColor: colors.brand[500], borderRadius: 16, paddingVertical: 14, marginBottom: 8, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>← Wróć do arkusza</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={discardAttempt}
                  style={{ backgroundColor: theme.inputBg, borderRadius: 16, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: theme.border }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Porzuć arkusz</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>📝</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text, textAlign: "center", marginBottom: 8 }}>
                  {untimed ? "Oddać arkusz i zobaczyć wynik?" : "Zakończyć i sprawdzić?"}
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center", marginBottom: 6, lineHeight: 19 }}>
                  Masz odpowiedzi w {answeredCount} z {allTasks.length}{" "}
                  {allTasks.length === 1 ? "zadania" : "zadań"}.
                  {answeredCount < allTasks.length
                    ? ` Zadania bez odpowiedzi (${allTasks.length - answeredCount}) dostaną 0 pkt.`
                    : ""}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: "center", marginBottom: 18, lineHeight: 17 }}>
                  {openAnswered === 0
                    ? "Wynik zobaczysz od razu."
                    : estimate && !estimate.enough
                      ? `Zadania zamknięte ocenimy od razu. Na ocenę zadań otwartych brakuje kredytów AI (masz ${estimate.remaining}, potrzeba ok. ${estimate.credits}) — ocenisz je później z ekranu wyniku.`
                      : `Zadania zamknięte ocenimy od razu, a ${openAnswered} ${openAnswered === 1 ? "zadanie otwarte" : openAnswered % 10 >= 2 && openAnswered % 10 <= 4 && (openAnswered % 100 < 10 || openAnswered % 100 >= 20) ? "zadania otwarte" : "zadań otwartych"} oceni AI${estimate ? ` (ok. ${estimate.credits} ${estimate.credits === 1 ? "kredyt" : estimate.credits % 10 >= 2 && estimate.credits % 10 <= 4 && (estimate.credits % 100 < 10 || estimate.credits % 100 >= 20) ? "kredyty" : "kredytów"})` : ""} — wynik po 1–3 min.`}
                </Text>
                <TouchableOpacity
                  onPress={() => handleSubmit(false)}
                  style={{ backgroundColor: colors.brand[500], borderRadius: 16, paddingVertical: 14, marginBottom: 6, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                    {untimed ? "Oddaj i sprawdź" : "Zakończ i sprawdź"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setConfirmModal(false)}
                  style={{ paddingVertical: 10, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 13, color: theme.textTertiary }}>← Wróć do arkusza</Text>
                </TouchableOpacity>
              </>
            )}
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
            <ScrollView>
              {data.exam.content.parts.map((part: any) => (
                <View key={part.id} style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: theme.textTertiary,
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    {part.name
                      .replace("Część ", "Cz. ")
                      .replace("Arkusz 2. ", "")}
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {part.tasks.map((task: any) => {
                      const hasAns =
                        answers[task.id] != null && answers[task.id] !== "";
                      const isCur = task.id === currentTaskId;
                      return (
                        <TouchableOpacity
                          key={task.id}
                          onPress={() => goToTask(task.id)}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isCur
                              ? colors.navy[500]
                              : hasAns
                                ? colors.brand[500] + "20"
                                : theme.inputBg,
                            borderWidth: isCur ? 0 : 1,
                            borderColor: hasAns
                              ? colors.brand[500]
                              : theme.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: isCur
                                ? "#fff"
                                : hasAns
                                  ? colors.brand[600]
                                  : theme.textSecondary,
                            }}
                          >
                            {task.number}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ TOP BAR ═══ */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: theme.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {/* Timer */}
          {!untimed && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 14,
                backgroundColor: isCritical
                  ? "#fef2f2"
                  : isWarning
                    ? "#fffbeb"
                    : theme.inputBg,
              }}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={
                  isCritical
                    ? "#ef4444"
                    : isWarning
                      ? "#f59e0b"
                      : theme.textSecondary
                }
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                  color: isCritical
                    ? "#ef4444"
                    : isWarning
                      ? "#f59e0b"
                      : theme.text,
                }}
              >
                {Math.floor(mins / 60)}:{String(mins % 60).padStart(2, "0")}:
                {String(secs).padStart(2, "0")}
              </Text>
            </View>
          )}

          {/* Progress text */}
          <View style={{ flex: 1, alignItems: "center" }}>
            {/* Który to arkusz: przedmiot + poziom (od backendu 2.09.2026;
                starszy backend nie przysyła pól — linia po prostu znika).
                Dwa Texty w rzędzie: przy ciasnym środku paska skraca się
                NAZWA przedmiotu, a poziom (PP/PR) zostaje zawsze widoczny. */}
            {data.exam.subjectName ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  maxWidth: "100%",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontSize: 11,
                    fontWeight: "700",
                    color: theme.text,
                  }}
                >
                  {data.exam.subjectName}
                </Text>
                {data.exam.level ? (
                  <Text
                    style={{ fontSize: 11, fontWeight: "700", color: theme.text }}
                  >
                    {` · ${data.exam.level === "ROZSZERZONY" ? "PR" : "PP"}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: theme.textSecondary,
              }}
            >
              {currentIndex + 1} / {allTasks.length}
            </Text>
            <Text style={{ fontSize: 10, color: theme.textTertiary }}>
              {answeredCount} {answeredCount === 1 ? "odpowiedź" : "odpowiedzi"}
            </Text>
            {/* Status autosave — uczeń musi widzieć, że praca jest zapisana */}
            {saveFailed ? (
              <Text style={{ fontSize: 9, color: "#ef4444", fontWeight: "700" }}>
                ⚠ zapis nieudany
              </Text>
            ) : lastSavedAt ? (
              <Text style={{ fontSize: 9, color: theme.textTertiary }}>
                ✓ zapisano{" "}
                {lastSavedAt.toLocaleTimeString("pl", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            ) : null}
          </View>

          {/* Nav + Submit */}
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
            onPress={openConfirm}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 14,
              backgroundColor: colors.brand[500],
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
              {untimed ? "Oddaj" : "Zakończ"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 3,
            backgroundColor: theme.border,
            borderRadius: 2,
            marginTop: 10,
          }}
        >
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.brand[500],
              width: `${(answeredCount / allTasks.length) * 100}%`,
            }}
          />
        </View>
      </View>

      {/* ═══ CONTENT ═══ */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        {/* Part header */}
        {currentPart && (
          <View
            style={{
              marginBottom: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
            }}
          >
            {untimed && (
              <TouchableOpacity onPress={() => setShowIntro(true)} hitSlop={8}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand[500], marginBottom: 4 }}>
                  ← Części arkusza
                </Text>
              </TouchableOpacity>
            )}
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: theme.text }}
            >
              {currentPart.name}
            </Text>
          </View>
        )}

        {/* Materials toggle */}
        {currentTask.materialIds?.length > 0 && currentPart && (
          <TouchableOpacity
            onPress={() => setShowMaterials(!showMaterials)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 14,
              backgroundColor: isDark ? "#312e81" + "20" : "#eef2ff",
              alignSelf: "flex-start",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: isDark ? "#818cf8" : "#4f46e5",
              }}
            >
              📄 {showMaterials ? "Ukryj teksty" : "Pokaż teksty"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Materials */}
        {showMaterials &&
          currentPart &&
          (currentTask.materialIds || []).map((matId: string) => {
            const mat = currentPart.materials?.find(
              (m: any) => m.id === matId,
            );
            if (!mat) return null;
            return (
              <SectionErrorBoundary
                key={mat.id}
                label={mat.title || "materiał"}
                resetKey={`${currentTask.id}:${mat.id}`}
                theme={theme}
              >
                <MaterialRenderer mat={mat} theme={theme} isDark={isDark} />
              </SectionErrorBoundary>
            );
          })}

        {/* Task card */}
        <Card style={{ marginBottom: 20 }}>
          {/* Narzędzia admina — niewidoczne dla ucznia. Kopiują dokładnie to,
              co renderuje ekran, więc zgłoszenie „to zadanie jest zepsute"
              da się odtworzyć bez szukania rekordu w bazie po opisie. */}
          <AdminCopyBar>
            <AdminCopyButton value={currentTask} label="⧉ JSON zadania" />
            <AdminCopyButton value={examId} label="⧉ ID egzaminu" />
            <AdminCopyButton value={currentTask.id} label="⧉ ID zadania" />
          </AdminCopyBar>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: colors.navy[500],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
                {currentTask.number}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: theme.textTertiary, flex: 1 }}>
              {currentTask.points} pkt
            </Text>
            {/* Zgłoszenie błędu w zadaniu — jak „Zgłoś" w quizie i jak na webie. */}
            <ReportButton
              exam={{
                examId,
                taskId: currentTask.id,
                taskLabel: String(currentTask.number ?? ""),
              }}
              questionPreview={cleanInstructionForDisplay(currentTask)}
            />
            {currentTask.gradingType === "ai" && (
              <View
                style={{
                  backgroundColor: isDark ? "#5b21b620" : "#f3e8ff",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 99,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: isDark ? "#c4b5fd" : "#7c3aed",
                  }}
                >
                  🤖 AI
                </Text>
              </View>
            )}
          </View>

          {/* Instruction */}
          <SectionErrorBoundary
            label="treść zadania"
            resetKey={currentTask.id}
            theme={theme}
          >
            <CodeAwareText
              text={cleanInstructionForDisplay(currentTask)}
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: theme.text,
                lineHeight: 24,
              }}
              containerStyle={{ marginBottom: 20 }}
              isDark={isDark}
            />

            {/* ═══ TASK INPUT RENDERERS ═══ */}
            <ExamTaskInput
              task={currentTask}
              value={answers[currentTask.id]}
              onChange={(v: any) => setAnswer(currentTask.id, v)}
              theme={theme}
              isDark={isDark}
            />
          </SectionErrorBoundary>
        </Card>
      </ScrollView>

      {/* ═══ BOTTOM NAV ═══ */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 2,
          paddingBottom: 0,
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.borderLight,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={goPrev}
          disabled={currentIndex === 0}
          style={{ padding: 10, opacity: currentIndex === 0 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textSecondary} />
        </TouchableOpacity>

        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 12,
            color: theme.textTertiary,
          }}
        >
          {currentIndex + 1} / {allTasks.length}
        </Text>

        {currentIndex < allTasks.length - 1 ? (
          <Button title="Następne →" onPress={goNext} size="sm" />
        ) : (
          <Button
            title={untimed ? "Oddaj ✓" : "Zakończ ✓"}
            onPress={openConfirm}
            size="sm"
          />
        )}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TASK INPUT RENDERER — renders input for each exam task type
// ══════════════════════════════════════════════════════════════════════════

// BiZ (biznes i zarządzanie): każdy typ `biz_*` ma TEN SAM kształt danych co
// jego odpowiednik `wos_*` — web robi z tego cienki adapter
// (frontend/…/BiznesTaskRenderers.tsx, BIZ_TO_WOS). Apka tego adaptera nie
// miała, a `biz_` nie było w żadnym wyrażeniu z prefiksami przedmiotów, więc
// WSZYSTKIE zadania BiZ — dopasowania, A/B/C/D, prawda/fałsz, kolejność —
// spadały do jednego pola tekstowego (zgłoszone 18.09.2026; 14 typów, 245
// zadań w aktywnych arkuszach). Dwa typy bez bliźniaka w WOS idą jak na webie
// do wieloliniowej odpowiedzi otwartej.
const BIZ_TO_WOS: Record<string, string> = {
  biz_calc: "wos_open_explain",
  biz_case_analysis: "wos_open_explain",
};
function mapBizTaskType(type: unknown): string {
  const t = String(type ?? "");
  if (!t.startsWith("biz_")) return t;
  return BIZ_TO_WOS[t] ?? `wos_${t.slice(4)}`;
}

function ExamTaskInput({
  task: rawTask,
  value,
  onChange,
  theme,
  isDark,
}: {
  task: any;
  value: any;
  onChange: (v: any) => void;
  theme: any;
  isDark: boolean;
}) {
  // Typ podmieniamy tylko do WYBORU renderera — id, treść i wszystko, co idzie
  // w odpowiedzi do backendu, zostaje nietknięte.
  const task = useMemo(
    () => ({ ...rawTask, type: mapBizTaskType(rawTask?.type) }),
    [rawTask],
  );
  const content = task.content || {};

  // ── Generic table/graph rendering (before task-specific input) ──
  // Jedna siatka dla nagłówka i wierszy (lib/tableWidths.ts) — bez tego
  // kolumny rozjeżdżały się wiersz po wierszu.
  const tableColW = content.table
    ? tableColWidths(content.table.headers, content.table.rows, {
        charPx: 6.2,
        firstMin: 120,
        min: 64,
      })
    : [];
  const tableElement = content.table ? (
    <View style={{ marginBottom: 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{ flexDirection: "row", backgroundColor: theme.inputBg }}
          >
            {content.table.headers.map((h: string, i: number) => (
              <View
                key={i}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRightWidth:
                    i < content.table.headers.length - 1 ? 1 : 0,
                  borderColor: theme.border,
                  width: tableColW[i],
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: theme.text }}
                >
                  {parseChemText(h)}
                </Text>
              </View>
            ))}
          </View>
          {/* Rows */}
          {content.table.rows.map((row: string[], ri: number) => (
            <View
              key={ri}
              style={{
                flexDirection: "row",
                borderTopWidth: 1,
                borderColor: theme.border,
              }}
            >
              {row.map((cell: string, ci: number) => (
                <View
                  key={ci}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRightWidth: ci < row.length - 1 ? 1 : 0,
                    borderColor: theme.border,
                    width: tableColW[ci],
                  }}
                >
                  <Text style={{ fontSize: 12, color: theme.text }}>
                    {parseChemText(cell)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  ) : null;

  const graphElement = content.graph ? (
    <View style={{ marginBottom: 16 }}>
      <MathGraph
        segments={content.graph.segments}
        points={content.graph.points}
        lines={content.graph.lines}
        circles={content.graph.circles}
        vectors={content.graph.vectors}
        xRange={content.graph.xRange}
        yRange={content.graph.yRange}
        height={content.graph.height || 280}
      />
    </View>
  ) : null;

  // Raw SVG (figury geometryczne, content.svg lub content.graphSvg)
  const svgString: string | null =
    typeof content.svg === "string" && content.svg.trim().length > 0
      ? content.svg
      : typeof content.graphSvg === "string" && content.graphSvg.trim().length > 0
        ? content.graphSvg
        : null;
  const svgElement = svgString ? (
    <SvgViewer svg={svgString} theme={theme} />
  ) : null;

  // ── Tier 2 specjalistyczne renderery — przed prefix mapperem,
  //    żeby sequence/cross_punnett/scheme_fill/fill_choose/info_*/table_fill/
  //    identify_persons NIE zostały zmapowane do generic textarea
  if (isTier2TaskType(task.type)) {
    return (
      <View>
        {svgElement}
        {graphElement}
        {tableElement}
        <Tier2TaskRenderer
          task={task}
          value={value}
          onChange={onChange}
          theme={theme}
          isDark={isDark}
        />
      </View>
    );
  }

  // ── German/English PP+PR renderers (listening_*, reading_*, writing*, …)
  if (isGermanTaskType(task.type)) {
    const subAnswers =
      typeof value === "object" && value && !Array.isArray(value) ? value : {};
    // Normalizacja zdryfowanych kształtów contentu angielskiego (port z weba
    // — bez niej część zadań EN renderowała się jako pusta). Typy _de trafiają
    // w default normalizera i wracają nietknięte.
    const normalizedTask = {
      ...task,
      content: normalizeEnglishContent(task.type, task.content),
    };
    return (
      <View>
        {svgElement}
        {graphElement}
        {tableElement}
        <GermanTaskRenderer
          task={normalizedTask}
          answers={subAnswers}
          onAnswer={(qId, v) => onChange({ ...subAnswers, [qId]: v })}
          theme={theme}
          isDark={isDark}
        />
      </View>
    );
  }

  // ── Prefix mapper — per-subject types (hist_*, bio_*, chem_*, phys_*,
  //    geo_*, wos_*, info_*) → reuse existing generic case'y w switchu poniżej.
  //    Compound (*_abcd_justified, *_abcd_justify) renderujemy specjalnie.
  const SUBJECT_PREFIXES = /^(hist|bio|chem|phys|geo|wos|info)_/;
  let effectiveType = task.type;
  let isCompoundJustify = false;
  // Humanistyczne (wos/hist/polski/geo) — bez palety LaTeX i hint'u
  const isHumanistic =
    /^(wos|hist|geo)_/.test(task.type) ||
    task.type === "open_short" ||
    task.type === "open_explain" ||
    task.type === "open_compare" ||
    task.type === "notatka" ||
    task.type === "wypracowanie";
  if (SUBJECT_PREFIXES.test(task.type)) {
    const suffix = task.type.replace(SUBJECT_PREFIXES, "");
    if (suffix === "abcd") effectiveType = "closed_abcd";
    else if (suffix === "abcd_justified" || suffix === "abcd_justify") {
      effectiveType = "closed_abcd";
      isCompoundJustify = true;
    } else if (suffix === "true_false") effectiveType = "math_true_false";
    else if (suffix === "multi_select") effectiveType = "math_multi_select";
    else if (suffix === "fill_blank" || suffix === "fill_value")
      effectiveType = "math_fill_blank";
    else if (suffix === "fill_table" || suffix === "table_fill")
      effectiveType = "fill_table";
    else if (suffix === "matching") effectiveType = "matching";
    else if (suffix === "open_short") effectiveType = "open_short";
    else if (
      suffix === "open_explain" ||
      suffix === "open_extended" ||
      suffix === "open_compare" ||
      suffix === "decide_justify" ||
      suffix === "compare_sources" ||
      suffix === "arguments" ||
      suffix === "propose" ||
      suffix === "explain" ||
      suffix === "derivation" ||
      suffix === "diagram" ||
      suffix === "construction" ||
      suffix === "experiment" ||
      suffix === "problem" ||
      suffix === "calculation" ||
      suffix === "equation" ||
      suffix === "interpret_visual" ||
      suffix === "style_recognition" ||
      suffix === "short_calc" ||
      suffix === "extended_calc" ||
      suffix === "fill_text" ||
      suffix === "analysis" ||
      suffix === "essay_5pt" ||
      suffix === "essay_7pt" ||
      suffix === "essay_10pt" ||
      suffix === "essay_15pt" ||
      suffix === "algorithm" ||
      suffix === "programming" ||
      suffix === "sql" ||
      suffix === "spreadsheet" ||
      suffix === "nuclear" ||
      suffix === "electronic"
    ) {
      effectiveType = "open_explain";
    }
  }

  // Compound: MCQ + textarea justification
  if (isCompoundJustify) {
    const compound =
      typeof value === "object" && value && !Array.isArray(value)
        ? value
        : { choice: null, justification: "" };
    const opts = content.options || [];
    return (
      <View>
        {svgElement}
        {graphElement}
        {tableElement}
        <View style={{ gap: 8, marginBottom: 16 }}>
          {opts.map((o: any) => (
            <OptionCard
              key={o.id}
              id={o.id}
              text={parseChemText(o.text)}
              state={compound.choice === o.id ? "selected" : "default"}
              onPress={() =>
                onChange({
                  ...compound,
                  choice: compound.choice === o.id ? null : o.id,
                })
              }
              disabled={false}
            />
          ))}
        </View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: theme.textSecondary,
            marginBottom: 6,
          }}
        >
          Uzasadnienie:
        </Text>
        <MathEditor
          value={compound.justification || ""}
          onChange={(text) => onChange({ ...compound, justification: text })}
          placeholder="Uzasadnij wybór..."
          taskType="math_short_calc"
        />
      </View>
    );
  }

  // ── phys_fill_value — backend wystawia {prefix, suffix, correctValue}
  //    (NIE {blanks[]}). Render: prefix tekst + TextInput + suffix (jednostka).
  if (
    task.type === "phys_fill_value" &&
    (content.prefix !== undefined ||
      content.suffix !== undefined ||
      content.correctValue !== undefined)
  ) {
    return (
      <View>
        {svgElement}
        {graphElement}
        {tableElement}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          {content.prefix ? (
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: theme.text,
              }}
            >
              {parseChemText(String(content.prefix))}
            </Text>
          ) : null}
          <TextInput
            value={typeof value === "string" ? value : ""}
            onChangeText={onChange}
            placeholder={content.hint || "wartość"}
            placeholderTextColor={theme.textTertiary}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            style={{
              minWidth: 120,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderBottomWidth: 2,
              borderBottomColor: colors.brand[500],
              fontSize: 16,
              fontWeight: "700",
              color: theme.text,
              textAlign: "center",
            }}
          />
          {content.suffix ? (
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: theme.text,
              }}
            >
              {parseChemText(String(content.suffix))}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // Wrap task-specific input with table/graph above it
  const taskInput = (() => {
    switch (effectiveType) {
      // ── OPEN / NOTATKA / WYPRACOWANIE ────────────────────────────────
      case "open_short":
      case "open_explain":
      case "open_compare":
        return (
          <MathEditor
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            placeholder="Napisz odpowiedź..."
            taskType="math_short_calc"
            plain={isHumanistic}
          />
        );

      case "notatka":
        return (
          <View>
            {content.topic && (
              <View
                style={{
                  backgroundColor: isDark ? "#047857" + "15" : "#ecfdf5",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "#04785740" : "#a7f3d0",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isDark ? "#34d399" : "#047857",
                  }}
                >
                  Temat:
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: theme.text,
                    marginTop: 2,
                  }}
                >
                  {parseChemText(content.topic)}
                </Text>
              </View>
            )}
            <MathEditor
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
              placeholder="Notatka syntetyzująca (60-90 słów)..."
              taskType="math_short_calc"
              plain
            />
            <WordCounter
              text={typeof value === "string" ? value : ""}
              min={60}
              max={90}
              theme={theme}
            />
          </View>
        );

      case "wypracowanie": {
        const cur =
          typeof value === "object" ? value : { topic: null, text: "" };
        return (
          <View>
            {content.topics?.map((t: any) => (
              <View
                key={t.number}
                style={{
                  backgroundColor: isDark ? colors.navy[500] + "15" : "#eef2ff",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: isDark ? colors.navy[500] + "30" : "#c7d2fe",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isDark ? colors.navy[400] : "#4f46e5",
                  }}
                >
                  Temat {t.number}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.text,
                    lineHeight: 20,
                    marginTop: 4,
                  }}
                >
                  {parseChemText(t.text)}
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {content.topics?.map((t: any) => (
                <TouchableOpacity
                  key={t.number}
                  onPress={() => onChange({ ...cur, topic: t.number })}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor:
                      cur.topic === t.number ? colors.navy[500] : theme.inputBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color:
                        cur.topic === t.number ? "#fff" : theme.textSecondary,
                    }}
                  >
                    Temat {t.number}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <MathEditor
              value={cur.text || ""}
              onChange={(text) => onChange({ ...cur, text })}
              placeholder="Napisz wypracowanie (min. 300 słów)..."
              taskType="math_extended_calc"
              plain
            />
            <WordCounter text={cur.text || ""} min={300} theme={theme} />
          </View>
        );
      }

      // ── TRUE_FALSE ───────────────────────────────────────────────────
      case "true_false": {
        const stmts = content.statements || [];
        const ans = Array.isArray(value) ? value : stmts.map(() => null);
        return (
          <View style={{ gap: 10 }}>
            {stmts.map((st: any, i: number) => (
              <View
                key={i}
                style={{
                  backgroundColor: theme.inputBg,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.text,
                    marginBottom: 10,
                    lineHeight: 20,
                  }}
                >
                  {st.text}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["P", "F"].map((label) => {
                    const val = label === "P";
                    const isSel = ans[i] === val;
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => {
                          const n = [...ans];
                          n[i] = val;
                          onChange(n);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          alignItems: "center",
                          borderWidth: 2,
                          borderColor: isSel
                            ? val
                              ? colors.brand[500]
                              : "#ef4444"
                            : theme.border,
                          backgroundColor: isSel
                            ? val
                              ? colors.brand[500] + "1A"
                              : "#ef4444" + "1A"
                            : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: isSel
                              ? val
                                ? colors.brand[600]
                                : "#ef4444"
                              : theme.textSecondary,
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        );
      }

      // ── CLOSED_ABCD ─────────────────────────────────────────────────
      case "closed_abcd": {
        const opts = content.options || [];
        // Compound (geo/bio/hist/wos): "A albo B" + uzasadnienie "1/2/3",
        // odpowiedź to string "A2" — parytet z webowym renderAbcd.
        const leftOptions = content.leftOptions;
        const rightOptions = content.rightOptions;
        if (
          Array.isArray(leftOptions) &&
          Array.isArray(rightOptions) &&
          leftOptions.length > 0
        ) {
          const selected = typeof value === "string" ? value : "";
          const leftPart = selected.charAt(0) || "";
          const rightPart = selected.slice(1) || "";
          const setCompound = (l: string, r: string) =>
            onChange(l || r ? l + r : null);
          const labelStyle = {
            fontSize: 12,
            fontWeight: "700" as const,
            color: theme.textSecondary,
            marginBottom: 6,
            textTransform: "uppercase" as const,
            letterSpacing: 0.5,
          };
          return (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={labelStyle}>Wybierz odpowiedź:</Text>
                <View style={{ gap: 8 }}>
                  {leftOptions.map((o: any) => (
                    <OptionCard
                      key={o.id}
                      id={o.id}
                      text={parseChemText(o.text)}
                      state={leftPart === o.id ? "selected" : "default"}
                      onPress={() =>
                        setCompound(leftPart === o.id ? "" : o.id, rightPart)
                      }
                      disabled={false}
                    />
                  ))}
                </View>
              </View>
              <View>
                <Text style={labelStyle}>oraz uzasadnienie:</Text>
                <View style={{ gap: 8 }}>
                  {rightOptions.map((o: any) => (
                    <OptionCard
                      key={o.id}
                      id={o.id}
                      text={parseChemText(o.text)}
                      state={rightPart === o.id ? "selected" : "default"}
                      onPress={() =>
                        setCompound(leftPart, rightPart === o.id ? "" : o.id)
                      }
                      disabled={false}
                    />
                  ))}
                </View>
              </View>
            </View>
          );
        }
        return (
          <View style={{ gap: 8 }}>
            {opts.map((o: any) => (
              <OptionCard
                key={o.id}
                id={o.id}
                text={parseChemText(o.text)}
                state={value === o.id ? "selected" : "default"}
                onPress={() => onChange(value === o.id ? null : o.id)}
                disabled={false}
              />
            ))}
          </View>
        );
      }

      // ── MATCHING ────────────────────────────────────────────────────
      case "matching": {
        const left = content.leftItems || [];
        const right = content.rightItems || [];
        const ans =
          typeof value === "object" && value && !Array.isArray(value)
            ? value
            : {};
        return (
          <View style={{ gap: 14 }}>
            {left.map((item: any) => (
              <View key={item.id}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: theme.text,
                    marginBottom: 6,
                  }}
                >
                  {item.id}. {parseChemText(item.text)}
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {right.map((r: any) => {
                    const isSel = ans[item.id] === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() =>
                          onChange({
                            ...ans,
                            [item.id]: isSel ? undefined : r.id,
                          })
                        }
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSel ? colors.brand[500] : theme.border,
                          backgroundColor: isSel
                            ? colors.brand[500] + "15"
                            : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: isSel
                              ? colors.brand[600]
                              : theme.textSecondary,
                          }}
                        >
                          {r.id}. {parseChemText(r.text)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        );
      }

      // ── FILL_TABLE ──────────────────────────────────────────────────
      case "fill_table": {
        const rows = content.rows || [];
        const ans =
          typeof value === "object" && value && !Array.isArray(value)
            ? value
            : {};
        return (
          <View style={{ gap: 12 }}>
            {rows.map((row: any, i: number) => (
              <View key={i}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: theme.text,
                    marginBottom: 4,
                  }}
                >
                  {parseChemText(row.label)}
                </Text>
                <TextInput
                  value={ans[row.label] || ""}
                  onChangeText={(text) =>
                    onChange({ ...ans, [row.label]: text })
                  }
                  placeholder="Wpisz..."
                  placeholderTextColor={theme.textTertiary}
                  style={{
                    backgroundColor: theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: theme.text,
                  }}
                />
              </View>
            ))}
          </View>
        );
      }
      // ── MATH TYPES (use MathEditor) ─────────────────────────────────
      // ABCD + wybór uzasadnienia (matematyka). Odpowiedź ma kształt
      // { answer, justification } — identyczny jak na webie
      // (MatematykaTaskRenderers.tsx → MathAbcdJustifiedTask). Do 18.09.2026
      // typ spadał do pola tekstowego, więc zadania nie dało się poprawnie
      // rozwiązać (17 zadań w aktywnych arkuszach).
      case "math_abcd_justified": {
        const answerOptions = content.answerOptions || content.options || [];
        const justificationOptions =
          content.justificationOptions || content.justifications || [];
        const cur =
          value && typeof value === "object" && !Array.isArray(value)
            ? value
            : { answer: null, justification: null };
        const group = (
          title: string,
          opts: any[],
          key: "answer" | "justification",
        ) => (
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: theme.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              {title}
            </Text>
            <View style={{ gap: 8 }}>
              {opts.map((o: any) => (
                <OptionCard
                  key={o.id}
                  id={o.id}
                  text={parseChemText(o.text)}
                  state={cur[key] === o.id ? "selected" : "default"}
                  onPress={() =>
                    onChange({ ...cur, [key]: cur[key] === o.id ? null : o.id })
                  }
                />
              ))}
            </View>
          </View>
        );
        return (
          <View style={{ gap: 18 }}>
            {group("Odpowiedź:", answerOptions, "answer")}
            {group("Uzasadnienie:", justificationOptions, "justification")}
          </View>
        );
      }

      // Zadania otwarte z poziomu rozszerzonego (math_pr_*) to te same zadania
      // obliczeniowe/dowodowe co na podstawie — należy im się edytor
      // matematyczny, a nie zwykłe pole tekstowe (300 zadań).
      case "math_pr_short":
      case "math_pr_extended":
      case "math_pr_parametric":
      case "math_pr_proof":
      case "math_pr_optimization":
      case "math_short_calc":
      case "math_extended_calc":
      case "math_proof":
      case "math_optimization": {
        return (
          <MathEditor
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            placeholder="Zapisz obliczenia i wynik..."
            taskType={task.type}
          />
        );
      }

      case "math_abcd": {
        const opts = content.options || [];
        return (
          <View style={{ gap: 8 }}>
            {opts.map((o: any) => (
              <OptionCard
                key={o.id}
                id={o.id}
                text={parseChemText(o.text)}
                state={value === o.id ? "selected" : "default"}
                onPress={() => onChange(value === o.id ? null : o.id)}
                disabled={false}
              />
            ))}
          </View>
        );
      }

      case "math_true_false":
      case "math_true_false_3": {
        const stmts = content.statements || [];
        const ans = Array.isArray(value) ? value : stmts.map(() => null);
        return (
          <View style={{ gap: 10 }}>
            {stmts.map((st: any, i: number) => (
              <View
                key={i}
                style={{
                  backgroundColor: theme.inputBg,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.text,
                    marginBottom: 10,
                    lineHeight: 20,
                  }}
                >
                  {parseChemText(st.text)}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["P", "F"].map((label) => {
                    const val = label === "P";
                    const isSel = ans[i] === val;
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => {
                          const n = [...ans];
                          n[i] = val;
                          onChange(n);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          alignItems: "center",
                          borderWidth: 2,
                          borderColor: isSel
                            ? val
                              ? colors.brand[500]
                              : "#ef4444"
                            : theme.border,
                          backgroundColor: isSel
                            ? val
                              ? colors.brand[500] + "1A"
                              : "#ef4444" + "1A"
                            : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: isSel
                              ? val
                                ? colors.brand[600]
                                : "#ef4444"
                              : theme.textSecondary,
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        );
      }

      case "math_fill_blank": {
        const blanks = content.blanks || [];
        const ans =
          typeof value === "object" && value && !Array.isArray(value)
            ? value
            : {};
        return (
          <View style={{ gap: 12 }}>
            {blanks.map((b: any, i: number) => (
              <View key={b.id || i}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: theme.text,
                    marginBottom: 4,
                  }}
                >
                  {parseChemText(b.label || `Luka ${i + 1}`)}
                </Text>
                <TextInput
                  value={ans[b.id] || ""}
                  onChangeText={(text) => onChange({ ...ans, [b.id]: text })}
                  placeholder="Wpisz..."
                  placeholderTextColor={theme.textTertiary}
                  style={{
                    backgroundColor: theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: theme.text,
                  }}
                />
              </View>
            ))}
          </View>
        );
      }

      case "math_two_part":
      case "math_multi_select": {
        if (effectiveType === "math_multi_select") {
          const opts = content.options || [];
          const sel = Array.isArray(value) ? value : [];
          return (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: theme.textSecondary,
                  marginBottom: 4,
                }}
              >
                Wybierz wszystkie poprawne
              </Text>
              {opts.map((o: any) => (
                <OptionCard
                  key={o.id}
                  id={o.id}
                  text={parseChemText(o.text)}
                  state={sel.includes(o.id) ? "selected" : "default"}
                  onPress={() =>
                    onChange(
                      sel.includes(o.id)
                        ? sel.filter((x: string) => x !== o.id)
                        : [...sel, o.id],
                    )
                  }
                  disabled={false}
                />
              ))}
            </View>
          );
        }
        // math_two_part z opcjami („Wybierz A albo B oraz C albo D” — matura PP
        // i egzamin ósmoklasisty). Backend porównuje odpowiedź
        // z `part.correctAnswer` pod kluczem `part.id || part<N>`, więc pole
        // tekstowe dawało 0 pkt każdemu, kto nie wpisał samej litery.
        const twoParts: any[] =
          Array.isArray(content.parts) && content.parts.length
            ? content.parts
            : [content.partA, content.partB].filter(Boolean);
        if (twoParts.length && twoParts.every((p) => Array.isArray(p?.options) && p.options.length)) {
          const picked =
            value && typeof value === "object" && !Array.isArray(value) ? value : {};
          return (
            <View style={{ gap: 18 }}>
              {twoParts.map((p: any, i: number) => {
                const key = p.id || `part${i + 1}`;
                return (
                  <View key={key} style={{ gap: 8 }}>
                    {!!p.label && (
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: theme.text,
                          lineHeight: 21,
                        }}
                      >
                        {parseChemText(p.label)}
                      </Text>
                    )}
                    {p.options.map((o: any) => (
                      <OptionCard
                        key={o.id}
                        id={o.id}
                        text={parseChemText(o.text)}
                        state={picked[key] === o.id ? "selected" : "default"}
                        onPress={() =>
                          onChange({
                            ...picked,
                            [key]: picked[key] === o.id ? null : o.id,
                          })
                        }
                        disabled={false}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          );
        }
        // math_two_part bez opcji — dwa pola tekstowe
        const cur =
          typeof value === "object" && value ? value : { part1: "", part2: "" };
        return (
          <View style={{ gap: 12 }}>
            {(
              content.parts || [{ label: "Część 1" }, { label: "Część 2" }]
            ).map((p: any, i: number) => (
              <View key={i}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: theme.text,
                    marginBottom: 4,
                  }}
                >
                  {p.label || `Część ${i + 1}`}
                </Text>
                <MathEditor
                  value={cur[`part${i + 1}`] || ""}
                  onChange={(text) =>
                    onChange({ ...cur, [`part${i + 1}`]: text })
                  }
                  placeholder="Odpowiedź..."
                  taskType="math_short_calc"
                  showExample={i === 0}
                />
              </View>
            ))}
          </View>
        );
      }
      // ── DEFAULT (textarea) ──────────────────────────────────────────
      default:
        return (
          <MathEditor
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            placeholder="Napisz odpowiedź..."
            taskType="math_short_calc"
            plain={isHumanistic}
          />
        );
    }
  })();

  // Render: svg/graph/table first, then task input
  return (
    <View>
      {svgElement}
      {graphElement}
      {tableElement}
      {taskInput}
    </View>
  );
}

// ── Word Counter ────────────────────────────────────────────────────────

function WordCounter({
  text,
  min,
  max,
  theme,
}: {
  text: string;
  min?: number;
  max?: number;
  theme: any;
}) {
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const under = min && count < min;
  const over = max && count > max;
  return (
    <View style={{ alignItems: "flex-end", marginTop: 6 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "500",
          fontVariant: ["tabular-nums"],
          color: over ? "#ef4444" : under ? "#f59e0b" : theme.textTertiary,
        }}
      >
        {count}
        {min ? ` / ${min}${max ? `–${max}` : "+"}` : ""} słów
      </Text>
    </View>
  );
}
