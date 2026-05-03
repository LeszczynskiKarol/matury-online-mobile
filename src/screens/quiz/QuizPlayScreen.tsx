// ============================================================================
// Quiz Play Screen — with live filters (1:1 with web QuizPlayer)
// ============================================================================

import { colors } from "../../theme/colors";
import { ListeningQuestion } from "../../components/quiz/ListeningQuestion";
import { ReportButton } from "../../components/quiz/ReportQuestion";
import { processGamificationResponse } from "../../components/common/GamificationToasts";
import {
  startListening,
  nextListening,
  endListening,
} from "../../api/listening";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MathGraph } from "../../components/quiz/MathGraph";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { submitAnswer, completeSession } from "../../api/sessions";
import {
  skipQuestion as apiSkipQuestion,
  getQuestions,
  getFilterOptions,
  trackView,
  Question,
  FilterOptions,
} from "../../api/questions";
import { OptionCard } from "../../components/quiz/OptionCard";
import { ProgressBar } from "../../components/common/ProgressBar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { parseChemText } from "../../utils/chemText";
import { MathEditor } from "../../components/exam/MathEditor";
import { spacing } from "../../theme";
import type { QuizStackParamList } from "../../navigation/types";

const SCREEN_WIDTH = Dimensions.get("window").width;

type Nav = NativeStackNavigationProp<QuizStackParamList>;

// ── Types ─────────────────────────────────────────────────────────────────
interface LiveFilters {
  topicIds: string[];
  types: string[];
  difficulties: number[];
  sources: string[];
}

const EMPTY_FILTERS: LiveFilters = {
  topicIds: [],
  types: [],
  difficulties: [],
  sources: [],
};

const TYPE_LABELS: Record<string, string> = {
  CLOSED: "Zamknięte",
  MULTI_SELECT: "Wielokrotne",
  TRUE_FALSE: "P/F",
  OPEN: "Otwarte",
  FILL_IN: "Uzupełnij",
  MATCHING: "Dopasuj",
  ORDERING: "Kolejność",
  WIAZKA: "Tekst",
  LISTENING: "Słuchanie",
  TABLE_DATA: "Tabela",
  GRAPH_INTERPRET: "Wykres",
  ERROR_FIND: "Błąd",
  CLOZE: "Luki",
  PROOF_ORDER: "Dowód",
  ESSAY: "Esej",
  DIAGRAM_LABEL: "Schemat",
  EXPERIMENT_DESIGN: "Doświadczenie",
  CROSS_PUNNETT: "Krzyżówka",
  CALCULATION: "Obliczenia",
};

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════

export function QuizPlayScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();

  const {
    sessionId,
    questions: initialQuestions,
    subjectName,
    subjectId,
    questionTypes: initialTypes,
  } = route.params as {
    sessionId: string;
    questions: Question[];
    subjectName: string;
    subjectId: string;
    questionTypes?: string[];
  };

  // ── Core state ──────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const scrollRef = useRef<ScrollView>(null);
  // ── Matching shuffled options (must be top-level hook) ─────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const question = questions[currentIndex];
  const matchingShuffledRight = useMemo(() => {
    if (question?.type !== "MATCHING" || !question?.content?.pairs) return [];
    return [...question.content.pairs.map((p: any) => p.right)].sort(
      () => Math.random() - 0.5,
    );
  }, [question?.id]);

  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ correct: 0, totalXp: 0, answered: 0 });
  const startTime = useRef(Date.now());
  const viewedIds = useRef<Set<string>>(new Set());
  const [resultsMap, setResultsMap] = useState<Record<string, any>>({});
  // ── Live filter state (identical to web) ────────────────────────────────
  const [filters, setFilters] = useState<LiveFilters>(() => ({
    ...EMPTY_FILTERS,
    types: initialTypes || [],
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(
    null,
  );
  const [poolTotal, setPoolTotal] = useState<number | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  // ── Listening mode ──────────────────────────────────────────────────────
  const isListeningOnly =
    initialTypes?.length === 1 && initialTypes[0] === "LISTENING";
  const [listeningSessionId, setListeningSessionId] = useState<string | null>(
    null,
  );
  const [listeningLoading, setListeningLoading] = useState(false);
  const [listeningInit, setListeningInit] = useState(isListeningOnly); // true = needs init

  // Init listening session
  useEffect(() => {
    if (!isListeningOnly || !listeningInit) return;
    (async () => {
      setListeningLoading(true);
      try {
        const res = await startListening({ subjectId });
        if (res.error) {
          Alert.alert("Błąd", res.error);
          return;
        }
        setListeningSessionId(res.sessionId);
        const q = res.question as any;
        answeredIds.current.add(q.id);
        setQuestions([q]);
        setCurrentIndex(0);
      } catch (err: any) {
        Alert.alert("Błąd", err.message || "Nie udało się uruchomić słuchania");
      } finally {
        setListeningLoading(false);
        setListeningInit(false);
      }
    })();
  }, [isListeningOnly, listeningInit]);

  // ── Answered IDs ref (never stale) ──────────────────────────────────────
  const answeredIds = useRef<Set<string>>(new Set());

  // Init answeredIds from initial questions
  useEffect(() => {
    initialQuestions.forEach((q) => answeredIds.current.add(q.id));
  }, []);

  // Load filter options once
  useEffect(() => {
    if (subjectId) {
      getFilterOptions(subjectId).then(setFilterOptions).catch(console.error);
    }
  }, [subjectId]);

  // ── Track question view (only once per question) ────────────────────────
  useEffect(() => {
    if (!question || loadingMore || listeningLoading) return;
    if (viewedIds.current.has(question.id)) return;
    viewedIds.current.add(question.id);
    trackView(question.id, listeningSessionId || sessionId).catch(() => {});
  }, [question?.id]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const content = question?.content;

  const MATH_SUBJECT_NAMES = [
    "matematyka",
    "fizyka",
    "chemia",
    "informatyka",
    "biologia",
  ];
  const needsMathEditor =
    MATH_SUBJECT_NAMES.some((s) => subjectName?.toLowerCase().includes(s)) ||
    MATH_SUBJECT_NAMES.some((s) =>
      question?.topic?.name?.toLowerCase().includes(s),
    );
  console.log(
    "[MATH-DEBUG] subjectName:",
    JSON.stringify(subjectName),
    "needsMathEditor:",
    needsMathEditor,
  );
  const hasActiveFilters =
    filters.topicIds.length > 0 ||
    filters.types.length > 0 ||
    filters.difficulties.length > 0 ||
    filters.sources.length > 0;
  const progress =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const isLastQuestion = currentIndex >= questions.length - 1;

  // ══════════════════════════════════════════════════════════════════════════
  // FILTER-DRIVEN QUESTION LOADING (identical to web loadFilteredQuestions)
  // ══════════════════════════════════════════════════════════════════════════

  const loadFilteredQuestions = useCallback(
    async (newFilters: LiveFilters) => {
      setLoadingMore(true);
      try {
        const data = await getQuestions({
          subjectId,
          topicIds:
            newFilters.topicIds.length > 0
              ? newFilters.topicIds.join(",")
              : undefined,
          types:
            newFilters.types.length > 0
              ? newFilters.types.join(",")
              : undefined,
          difficulties:
            newFilters.difficulties.length > 0
              ? newFilters.difficulties.join(",")
              : undefined,
          sources:
            newFilters.sources.length > 0
              ? newFilters.sources.join(",")
              : undefined,
          exclude: [...answeredIds.current].join(","),
          shuffle: true,
          limit: 30,
        });
        data.questions.forEach((q: any) => answeredIds.current.add(q.id));
        setQuestions(data.questions);
        setPoolTotal(data.total);
        setCurrentIndex(0);
        resetForNextQuestion();
      } catch (err: any) {
        Alert.alert("Błąd", err.message || "Nie udało się załadować pytań");
      } finally {
        setLoadingMore(false);
      }
    },
    [subjectId],
  );

  const handleFiltersChange = useCallback(
    (newFilters: LiveFilters) => {
      setFilters(newFilters);
      answeredIds.current.clear();
      const hasAny =
        newFilters.topicIds.length > 0 ||
        newFilters.types.length > 0 ||
        newFilters.difficulties.length > 0 ||
        newFilters.sources.length > 0;
      if (hasAny) {
        loadFilteredQuestions(newFilters);
      } else {
        // All filters cleared — reload unfiltered
        setPoolTotal(undefined);
        setLoadingMore(true);
        getQuestions({
          subjectId,
          exclude: [...answeredIds.current].join(","),
          shuffle: true,
          limit: 10,
        })
          .then((data) => {
            data.questions.forEach((q: any) => answeredIds.current.add(q.id));
            setQuestions(data.questions);
            setCurrentIndex(0);
            resetForNextQuestion();
          })
          .catch(console.error)
          .finally(() => setLoadingMore(false));
      }
    },
    [loadFilteredQuestions, subjectId],
  );

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPoolTotal(undefined);
    handleFiltersChange(EMPTY_FILTERS);
  }, [handleFiltersChange]);

  // ══════════════════════════════════════════════════════════════════════════
  // QUIZ ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  const getResponse = () => {
    if (!question) return null;
    switch (question.type) {
      case "FILL_IN":
      case "EXPERIMENT_DESIGN": {
        const obj =
          selectedAnswer &&
          typeof selectedAnswer === "object" &&
          !Array.isArray(selectedAnswer)
            ? selectedAnswer
            : null;
        if (!obj) return null;
        return Object.values(obj).some((v: any) => v?.trim()) ? obj : null;
      }
      case "CALCULATION":
        return openAnswer?.trim() || null;
      case "LISTENING": {
        const lAns =
          selectedAnswer &&
          typeof selectedAnswer === "object" &&
          !Array.isArray(selectedAnswer)
            ? selectedAnswer
            : null;
        return lAns && Object.keys(lAns).length > 0 ? lAns : null;
      }
      case "GRAPH_INTERPRET":
      case "TABLE_DATA": {
        const obj =
          selectedAnswer &&
          typeof selectedAnswer === "object" &&
          !Array.isArray(selectedAnswer)
            ? selectedAnswer
            : null;
        if (!obj) return null;
        return Object.values(obj).some((v: any) => v?.trim()) ? obj : null;
      }
      case "ERROR_FIND":
        return selectedAnswer;
      case "ORDERING":
      case "PROOF_ORDER":
        return Array.isArray(selectedAnswer) ? selectedAnswer : null;
      case "WIAZKA": {
        const w =
          selectedAnswer &&
          typeof selectedAnswer === "object" &&
          !Array.isArray(selectedAnswer)
            ? selectedAnswer
            : null;
        return w && Object.keys(w).length > 0 ? w : null;
      }
      case "CLOSED":
        return selectedAnswer;
      case "MULTI_SELECT":
        return Array.isArray(selectedAnswer) && selectedAnswer.length > 0
          ? selectedAnswer
          : null;
      case "MATCHING":
        const m =
          selectedAnswer &&
          typeof selectedAnswer === "object" &&
          !Array.isArray(selectedAnswer)
            ? selectedAnswer
            : null;
        return m && Object.keys(m).length === content.pairs?.length ? m : null;
      case "TRUE_FALSE":
        if (!Array.isArray(selectedAnswer)) return null;
        return selectedAnswer.every((v: any) => v !== null)
          ? selectedAnswer
          : null;
      case "OPEN":
      case "ESSAY":
        return openAnswer || null;
      case "CLOZE": {
        const c =
          selectedAnswer &&
          typeof selectedAnswer === "object" &&
          !Array.isArray(selectedAnswer)
            ? selectedAnswer
            : null;
        if (!c || !content.blanks) return null;
        const allFilled = Object.keys(content.blanks).every((k: string) =>
          (c as any)[k]?.trim(),
        );
        return allFilled ? c : null;
      }
      default:
        return selectedAnswer || openAnswer || null;
    }
  };

  const resetForNextQuestion = () => {
    setSelectedAnswer(null);
    setOpenAnswer("");
    setSubmitted(false);
    setResult(null);
    startTime.current = Date.now();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSubmit = async () => {
    const response = getResponse();
    if (!response) return Alert.alert("Wybierz odpowiedź");
    setLoading(true);
    try {
      const timeSpentMs = Date.now() - startTime.current;
      const res = await submitAnswer({
        questionId: question.id,
        sessionId: listeningSessionId || sessionId,
        response,
        timeSpentMs,
      });
      if (res.gamification)
        processGamificationResponse(res.gamification as any);
      answeredIds.current.add(question.id);
      setResult(res);
      setSubmitted(true);
      setResultsMap((prev) => ({ ...prev, [question.id]: res }));
      setStats((prev) => ({
        correct: prev.correct + (res.isCorrect ? 1 : 0),
        totalXp: prev.totalXp + (res.xpEarned || 0),
        answered: prev.answered + 1,
      }));
    } catch (err: any) {
      Alert.alert("Błąd", err.message || "Nie udało się zapisać odpowiedzi");
    } finally {
      setLoading(false);
    }
  };

  // ── SKIP — identical to web: loads more if pool empty ──────────────────
  const handleSkip = useCallback(() => {
    if (!question) return;
    apiSkipQuestion(question.id, listeningSessionId || sessionId).catch(
      console.error,
    );
    answeredIds.current.add(question.id);

    // Listening-only: fetch next from AI
    if (isListeningOnly && listeningSessionId) {
      resetForNextQuestion();
      setListeningLoading(true);
      nextListening({ sessionId: listeningSessionId, subjectId })
        .then((res) => {
          if (res.error) return;
          const q = res.question as any;
          answeredIds.current.add(q.id);
          setQuestions((prev) => [...prev, q]);
          setCurrentIndex((i) => i + 1);
        })
        .catch(() => {})
        .finally(() => setListeningLoading(false));
      return;
    }

    if (isLastQuestion) {
      if (hasActiveFilters) {
        loadFilteredQuestions(filters);
      } else {
        setLoadingMore(true);
        getQuestions({
          subjectId,
          exclude: [...answeredIds.current].join(","),
          shuffle: true,
          limit: 10,
        })
          .then((data) => {
            if (data.questions.length > 0) {
              data.questions.forEach((q: any) => answeredIds.current.add(q.id));
              setQuestions(data.questions);
              setCurrentIndex(0);
              resetForNextQuestion();
            } else {
              goToResults();
            }
          })
          .catch(() => goToResults())
          .finally(() => setLoadingMore(false));
      }
    } else {
      setCurrentIndex((i) => i + 1);
      resetForNextQuestion();
    }
  }, [
    question,
    isLastQuestion,
    sessionId,
    listeningSessionId,
    hasActiveFilters,
    filters,
    subjectId,
    isListeningOnly,
  ]);

  // ── NEXT — after feedback, loads more if pool empty ────────────────────
  const handleNext = useCallback(async () => {
    // ── Listening: fetch next from AI ──────────────────────────────────
    if (isListeningOnly && listeningSessionId) {
      setListeningLoading(true);
      try {
        const res = await nextListening({
          sessionId: listeningSessionId,
          subjectId,
        });
        if (res.error) {
          if (res.retry) {
            Alert.alert("Generowanie...", "Spróbuj za chwilę");
          } else {
            Alert.alert("Błąd", res.error);
          }
          setListeningLoading(false);
          return;
        }
        const q = res.question as any;
        answeredIds.current.add(q.id);
        setQuestions((prev) => [...prev, q]);
        setCurrentIndex((i) => i + 1);
        resetForNextQuestion();
      } catch (err: any) {
        Alert.alert(
          "Błąd",
          err.message || "Nie udało się pobrać kolejnego nagrania",
        );
      } finally {
        setListeningLoading(false);
      }
      return;
    }

    if (isLastQuestion) {
      if (hasActiveFilters) {
        loadFilteredQuestions(filters);
        return;
      }
      // Try loading more
      try {
        const data = await getQuestions({
          subjectId,
          exclude: [...answeredIds.current].join(","),
          shuffle: true,
          limit: 10,
        });
        if (data.questions.length > 0) {
          data.questions.forEach((q: any) => answeredIds.current.add(q.id));
          setQuestions(data.questions);
          setCurrentIndex(0);
          resetForNextQuestion();
          return;
        }
      } catch {}
      await goToResults();
    } else {
      setCurrentIndex((i) => i + 1);
      resetForNextQuestion();
    }
  }, [
    isLastQuestion,
    hasActiveFilters,
    filters,
    subjectId,
    isListeningOnly,
    listeningSessionId,
  ]);

  const handlePrevious = useCallback(() => {
    if (currentIndex <= 0) return;
    setCurrentIndex((i) => i - 1);
    setSelectedAnswer(null);
    setOpenAnswer("");
    setSubmitted(false);
    setResult(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentIndex]);

  const goToResults = async () => {
    if (isListeningOnly && listeningSessionId) {
      endListening(listeningSessionId).catch(console.error);
    }
    try {
      const sessionResult = await completeSession(sessionId);
      navigation.replace("QuizResult", {
        sessionId: listeningSessionId || sessionId,
        questionsAnswered: sessionResult.questionsAnswered,
        correctAnswers: sessionResult.correctAnswers,
        accuracy: sessionResult.accuracy,
        xpEarned: sessionResult.totalXpEarned,
        totalTimeMs: sessionResult.totalTimeMs,
      });
    } catch {
      navigation.replace("QuizResult", {
        sessionId: listeningSessionId || sessionId,
        questionsAnswered: stats.answered,
        correctAnswers: stats.correct,
        accuracy:
          stats.answered > 0
            ? Math.round((stats.correct / stats.answered) * 100)
            : 0,
        xpEarned: stats.totalXp,
        totalTimeMs: 0,
      });
    }
  };

  const endSession = useCallback(() => {
    completeSession(sessionId).catch(console.error);
    goToResults();
  }, [sessionId]);

  const handleQuit = () => {
    Alert.alert("Zakończyć?", "Twój postęp zostanie zapisany.", [
      { text: "Kontynuuj", style: "cancel" },
      {
        text: "Zakończ",
        style: "destructive",
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  // ── Option state helper ─────────────────────────────────────────────────
  const getOptionState = (optId: string) => {
    if (!submitted) return optId === selectedAnswer ? "selected" : "default";
    if (content.correctAnswer === optId) return "correct";
    if (optId === selectedAnswer && content.correctAnswer !== optId)
      return "wrong";
    return "default";
  };

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!question && !loadingMore && !listeningLoading && !listeningInit) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🏁</Text>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: theme.text,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          To było ostatnie zadanie
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.textSecondary,
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 21,
            maxWidth: 280,
          }}
        >
          {hasActiveFilters
            ? "Rozwiązałeś wszystkie pytania z wybranej kategorii. Co teraz?"
            : "Rozwiązałeś wszystkie dostępne pytania. Co teraz?"}
        </Text>
        <View style={{ gap: 12, width: "100%", maxWidth: 300 }}>
          {hasActiveFilters && (
            <Button
              title="🔄 Od nowa z tej kategorii"
              onPress={() => {
                answeredIds.current.clear();
                loadFilteredQuestions(filters);
              }}
            />
          )}
          <Button
            title="🎯 Wszystkie kategorie"
            onPress={() => {
              answeredIds.current.clear();
              clearFilters();
            }}
            variant="outline"
          />
          {stats.answered > 0 && (
            <Button
              title="📊 Pokaż wyniki"
              onPress={goToResults}
              variant="outline"
            />
          )}
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: spacing[5],
          paddingBottom: 12,
          backgroundColor: theme.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
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
          <TouchableOpacity onPress={handleQuit}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Outfit_600SemiBold",
                color: theme.text,
              }}
            >
              {currentIndex + 1} / {questions.length}
            </Text>
            {poolTotal !== undefined && hasActiveFilters && (
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                (pula: {poolTotal})
              </Text>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                fontSize: 11,
                color: colors.brand[500],
                fontWeight: "600",
              }}
            >
              +{stats.totalXp} XP
            </Text>
            {stats.answered > 0 && (
              <TouchableOpacity onPress={endSession}>
                <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                  Zakończ
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <ProgressBar progress={progress} height={4} animated={false} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[4],
          paddingBottom: 90,
        }}
      >
        {/* ── LIVE FILTER BAR ──────────────────────────────────────────── */}
        <LiveFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClear={clearFilters}
          open={filtersOpen}
          setOpen={setFiltersOpen}
          filterOptions={filterOptions}
          poolTotal={poolTotal}
          loading={loadingMore}
          theme={theme}
        />

        {/* Loading overlay */}
        {(loadingMore || listeningLoading) && (
          <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
            <ActivityIndicator size="small" color={colors.brand[500]} />
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
              {isListeningOnly
                ? "🤖 AI generuje nagranie..."
                : "Ładuję pytania..."}
            </Text>
            {isListeningOnly && (
              <Text
                style={{
                  fontSize: 10,
                  color: theme.textTertiary,
                  textAlign: "center",
                  maxWidth: 260,
                }}
              >
                Claude pisze transkrypt, Google TTS syntezuje głos — ~20-30s
              </Text>
            )}
          </View>
        )}

        {/* ── Question content ─────────────────────────────────────────── */}
        {!loadingMore && !listeningLoading && question && (
          <>
            {/* Metadata */}
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginBottom: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 9999,
                  backgroundColor: theme.primaryLight,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "500",
                    color: theme.primaryText,
                  }}
                >
                  {question.topic?.name}
                </Text>
              </View>

              {/* Difficulty badge z label */}
              {(() => {
                const d = question.difficulty;
                const labels = [
                  "",
                  "Łatwe",
                  "Podstawa",
                  "Średnie",
                  "Trudne",
                  "Ekspert",
                ];
                const dotColors = [
                  "",
                  "#22c55e",
                  "#0ea5e9",
                  "#f59e0b",
                  "#f97316",
                  "#ef4444",
                ];
                const bgColors = [
                  "",
                  "#dcfce720",
                  "#e0f2fe20",
                  "#fef3c720",
                  "#fff7ed20",
                  "#fef2f220",
                ];
                const textColors = [
                  "",
                  "#16a34a",
                  "#0284c7",
                  "#d97706",
                  "#ea580c",
                  "#dc2626",
                ];
                return (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      backgroundColor: bgColors[d] || "transparent",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 2,
                        alignItems: "center",
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((i) => (
                        <View
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor:
                              i <= d ? dotColors[d] : theme.border,
                          }}
                        />
                      ))}
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: textColors[d] || theme.textSecondary,
                      }}
                    >
                      {labels[d]}
                    </Text>
                  </View>
                );
              })()}

              {question.source && (
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.textTertiary,
                    marginLeft: "auto",
                  }}
                >
                  {question.source}
                </Text>
              )}
              {(() => {
                const t = question.type;
                const c = content;
                if (t === "LISTENING")
                  return <AiBadge label="~4 kr." isDark={isDark} />;
                if (t === "OPEN")
                  return <AiBadge label="~1 kr." isDark={isDark} />;
                if (t === "ESSAY")
                  return <AiBadge label="~3 kr." isDark={isDark} />;
                if (t === "EXPERIMENT_DESIGN")
                  return (
                    <AiBadge
                      label={`~${c.fields?.length || 1} kr.`}
                      isDark={isDark}
                    />
                  );
                if (
                  t === "WIAZKA" &&
                  c.subQuestions?.some((sq: any) => sq.type === "OPEN")
                ) {
                  const n = c.subQuestions.filter(
                    (sq: any) => sq.type === "OPEN",
                  ).length;
                  return <AiBadge label={`~${n} kr.`} isDark={isDark} />;
                }
                if (t === "CALCULATION" && c.showSteps)
                  return <AiBadge label="~1 kr." />;
                if (
                  [
                    "CLOZE",
                    "FILL_IN",
                    "TABLE_DATA",
                    "GRAPH_INTERPRET",
                    "DIAGRAM_LABEL",
                    "CROSS_PUNNETT",
                    "CALCULATION",
                  ].includes(t)
                ) {
                  const n =
                    t === "CLOZE"
                      ? Object.keys(c.blanks || {}).length
                      : t === "FILL_IN"
                        ? c.blanks?.length || 1
                        : t === "TABLE_DATA" || t === "GRAPH_INTERPRET"
                          ? c.subQuestions?.length || 1
                          : t === "DIAGRAM_LABEL"
                            ? c.labels?.length || 1
                            : t === "CROSS_PUNNETT"
                              ? c.questions?.length || 1
                              : 1;
                  return <AiBadge label={`~${n} kr.`} isDark={isDark} />;
                }
                return null;
              })()}
              <ReportButton
                questionId={question.id}
                questionPreview={
                  content?.question || content?.context || content?.prompt
                }
              />
            </View>

            {/* Work / Epoch badges */}
            {(content.work ||
              (content.epochLabel &&
                content.epochLabel !== question.topic?.name)) && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {content.work && (
                  <View
                    style={{
                      backgroundColor: isDark ? "#5b21b615" : "#f3e8ff",
                      borderWidth: 1,
                      borderColor: isDark ? "#5b21b640" : "#e9d5ff",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 99,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: isDark ? "#c4b5fd" : "#7c3aed",
                      }}
                    >
                      📚 {content.work}
                    </Text>
                  </View>
                )}
                {content.epochLabel &&
                  content.epochLabel !== question.topic?.name && (
                    <View
                      style={{
                        backgroundColor: isDark
                          ? colors.navy[500] + "15"
                          : "#e0e7ff",
                        borderWidth: 1,
                        borderColor: isDark
                          ? colors.navy[500] + "30"
                          : "#c7d2fe",
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 99,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "500",
                          color: isDark ? colors.navy[400] : "#4f46e5",
                        }}
                      >
                        {content.epochLabel}
                      </Text>
                    </View>
                  )}
                {content.author && (
                  <View
                    style={{
                      backgroundColor: isDark
                        ? colors.navy[500] + "15"
                        : "#e0e7ff",
                      borderWidth: 1,
                      borderColor: isDark ? colors.navy[500] + "30" : "#c7d2fe",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 99,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "500",
                        color: isDark ? colors.navy[400] : "#4f46e5",
                      }}
                    >
                      ✍️ {content.author}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Context */}
            {(content.additionalContext || content.context) && (
              <View
                style={{
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontStyle: "italic",
                    color: theme.text,
                    lineHeight: 21,
                  }}
                >
                  {parseChemText(
                    content.additionalContext || content.context || "",
                  )}
                </Text>
              </View>
            )}
            {/* Word do analizy */}
            {content.word && (
              <View
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: isDark ? colors.navy[500] + "15" : "#eef2ff",
                  borderWidth: 1,
                  borderColor: isDark ? colors.navy[500] + "30" : "#c7d2fe",
                  marginBottom: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: isDark ? colors.navy[400] : "#6366f1",
                    marginBottom: 4,
                  }}
                >
                  Wyraz:
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "700",
                    color: isDark ? colors.navy[300] : "#4338ca",
                  }}
                >
                  „{content.word}"
                </Text>
              </View>
            )}
            {/* Source text */}
            {content.sourceText && (
              <View
                style={{
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                {(content.sourceText.title || content.sourceText.author) && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    {content.sourceText.title && (
                      <View
                        style={{
                          backgroundColor: "#f3e8ff",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 99,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: "#7c3aed",
                          }}
                        >
                          📚 {content.sourceText.title}
                        </Text>
                      </View>
                    )}
                    {content.sourceText.author && (
                      <View
                        style={{
                          backgroundColor: "#e0e7ff",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 99,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "500",
                            color: "#4f46e5",
                          }}
                        >
                          ✍️ {content.sourceText.author}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <Text
                  style={{
                    fontSize: 14,
                    fontStyle: "italic",
                    color: theme.text,
                    lineHeight: 22,
                  }}
                >
                  {content.sourceText.text}
                </Text>
              </View>
            )}
            {/* Debug — raw question data when nothing renders */}
            {!content.question &&
              !content.prompt &&
              !content.options &&
              !content.pairs &&
              !content.statements &&
              !content.template &&
              !content.blanks &&
              !content.steps &&
              !content.subQuestions &&
              !content.table &&
              !content.graph && (
                <View
                  style={{
                    backgroundColor: "#fef2f2",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 21,
                      fontWeight: "700",
                      color: "#dc2626",
                      marginBottom: 6,
                    }}
                  >
                    ⚠️ DEBUG — puste pytanie (type: {question.type})
                  </Text>
                  <Text
                    style={{
                      fontSize: 9,
                      fontFamily: "JetBrainsMono_400Regular",
                      color: "#666",
                    }}
                    selectable
                  >
                    {JSON.stringify(question, null, 2)}
                  </Text>
                </View>
              )}
            {/* Question text */}
            {question.type !== "LISTENING" && (
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "500",
                  color: theme.text,
                  lineHeight: 26,
                  marginBottom: 24,
                }}
              >
                {parseChemText(content.question || content.prompt || "")}
                {/* Debug — raw question data when nothing renders */}
                {!content.question &&
                  !content.prompt &&
                  !content.options &&
                  !content.pairs &&
                  !content.statements &&
                  !content.template &&
                  !content.blanks &&
                  !content.steps &&
                  !content.subQuestions &&
                  !content.table &&
                  !content.graph && (
                    <View
                      style={{
                        backgroundColor: "#fef2f2",
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 16,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#dc2626",
                          marginBottom: 6,
                        }}
                      >
                        ⚠️ DEBUG — puste pytanie (type: {question.type})
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          fontFamily: "JetBrainsMono_400Regular",
                          color: "#666",
                        }}
                        selectable
                      >
                        {JSON.stringify(question, null, 2)}
                      </Text>
                    </View>
                  )}
              </Text>
            )}

            {/* ── Feedback (above answer options) ──────────────────────── */}
            {submitted &&
              result &&
              !(
                result.revealed && ["EXPERIMENT_DESIGN"].includes(question.type)
              ) &&
              !(
                result.revealed &&
                ["OPEN", "ESSAY"].includes(question.type) &&
                content?.sampleAnswer
              ) && (
                <Card
                  style={{
                    marginBottom: 20,
                    borderColor: result.revealed
                      ? colors.navy[400]
                      : result.isCorrect
                        ? colors.brand[500]
                        : result.score > 0
                          ? "#f59e0b"
                          : colors.red[500],
                    borderWidth: 2,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons
                      name={
                        result.revealed
                          ? "eye"
                          : result.isCorrect
                            ? "checkmark-circle"
                            : "close-circle"
                      }
                      size={24}
                      color={
                        result.revealed
                          ? colors.navy[400]
                          : result.isCorrect
                            ? colors.brand[500]
                            : colors.red[500]
                      }
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: result.revealed
                          ? colors.navy[500]
                          : result.isCorrect
                            ? colors.brand[600]
                            : result.score > 0
                              ? "#d97706"
                              : colors.red[600],
                      }}
                    >
                      {result.revealed
                        ? "Poprawna odpowiedź"
                        : result.isCorrect
                          ? "Brawo!"
                          : result.score > 0
                            ? `Częściowo — ${Math.round(result.score * 100)}%`
                            : "Niestety, źle"}
                    </Text>
                    {!result.revealed &&
                      result.score != null &&
                      result.score !== 1 &&
                      result.score !== 0 && (
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: theme.textSecondary,
                          }}
                        >
                          {Math.round(result.score * 100)}%
                        </Text>
                      )}
                    {result.xpEarned > 0 && (
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: colors.brand[500],
                          marginLeft: "auto",
                        }}
                      >
                        +{result.xpEarned} XP
                      </Text>
                    )}
                  </View>
                  {result.aiGrading?.feedback && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: theme.textSecondary,
                        lineHeight: 21,
                        marginBottom: 6,
                      }}
                    >
                      {result.aiGrading.feedback}
                    </Text>
                  )}
                  {result.explanation && !result.aiGrading?.feedback && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: theme.textSecondary,
                        lineHeight: 21,
                      }}
                    >
                      {parseChemText(result.explanation)}
                    </Text>
                  )}
                  {result.correctAnswer &&
                    !result.isCorrect &&
                    !["EXPERIMENT_DESIGN", "CALCULATION"].includes(
                      question.type,
                    ) && (
                      <View style={{ marginTop: 6 }}>
                        <FormattedAnswer
                          answer={result.correctAnswer}
                          questionType={question.type}
                          content={content}
                          theme={theme}
                        />
                      </View>
                    )}
                  {result.revealed &&
                    !result.correctAnswer &&
                    !result.explanation &&
                    !content?.sampleAnswer &&
                    ![
                      "EXPERIMENT_DESIGN",
                      "CALCULATION",
                      "CLOSED",
                      "MULTI_SELECT",
                      "TRUE_FALSE",
                      "FILL_IN",
                      "CLOZE",
                      "MATCHING",
                      "ERROR_FIND",
                      "GRAPH_INTERPRET",
                      "TABLE_DATA",
                      "ORDERING",
                      "PROOF_ORDER",
                      "WIAZKA",
                    ].includes(question.type) && (
                      <Text
                        style={{
                          fontSize: 13,
                          color: theme.textTertiary,
                          fontStyle: "italic",
                          marginTop: 6,
                        }}
                      >
                        Brak proponowanego rozwiązania dla tego pytania.
                      </Text>
                    )}
                </Card>
              )}

            {/* ── QUESTION TYPE RENDERERS ──────────────────────────────── */}

            {/* MULTI_SELECT */}
            {question.type === "MULTI_SELECT" && content.options && (
              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Wybierz wszystkie poprawne
                </Text>
                {content.options.map((opt: any) => {
                  const sel = Array.isArray(selectedAnswer)
                    ? selectedAnswer
                    : [];
                  const isSelected = sel.includes(opt.id);
                  return (
                    <OptionCard
                      key={opt.id}
                      id={opt.id}
                      text={parseChemText(opt.text)}
                      state={
                        submitted
                          ? content.correctAnswers?.includes(opt.id)
                            ? "correct"
                            : isSelected
                              ? "wrong"
                              : "default"
                          : isSelected
                            ? "selected"
                            : "default"
                      }
                      onPress={() => {
                        if (submitted) return;
                        setSelectedAnswer(
                          isSelected
                            ? sel.filter((id: string) => id !== opt.id)
                            : [...sel, opt.id],
                        );
                      }}
                      disabled={submitted}
                    />
                  );
                })}
              </View>
            )}

            {/* CLOSED */}
            {question.type === "CLOSED" && content.options && (
              <View style={{ gap: 10 }}>
                {content.options.map((opt: any) => (
                  <OptionCard
                    key={opt.id}
                    id={opt.id}
                    text={parseChemText(opt.text)}
                    state={getOptionState(opt.id) as any}
                    onPress={() =>
                      !submitted &&
                      setSelectedAnswer(
                        selectedAnswer === opt.id ? null : opt.id,
                      )
                    }
                    disabled={submitted}
                  />
                ))}
              </View>
            )}

            {/* TRUE_FALSE */}
            {question.type === "TRUE_FALSE" &&
              content.statements &&
              (() => {
                const ans = Array.isArray(selectedAnswer)
                  ? selectedAnswer
                  : content.statements.map(() => null);
                // Poprawne odpowiedzi (z contentu lub z result)
                const correctAnswers = submitted
                  ? result?.correctAnswer ||
                    content.statements.map((s: any) => s.isTrue)
                  : null;
                return (
                  <View style={{ gap: 12 }}>
                    {content.statements.map((stmt: any, i: number) => {
                      const userVal = ans[i];
                      const correctVal = correctAnswers
                        ? correctAnswers[i]
                        : null;
                      const isCorrectStatement =
                        submitted && userVal === correctVal;
                      const isWrongStatement =
                        submitted && userVal !== null && userVal !== correctVal;

                      return (
                        <Card
                          key={i}
                          variant="stat"
                          style={
                            submitted
                              ? {
                                  borderWidth: 2,
                                  borderColor: isCorrectStatement
                                    ? colors.brand[500]
                                    : isWrongStatement
                                      ? colors.red[500]
                                      : theme.cardBorder,
                                }
                              : undefined
                          }
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontFamily: "DMSans_400Regular",
                              color: theme.text,
                              marginBottom: 10,
                            }}
                          >
                            {parseChemText(stmt.text)}
                          </Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            {["Prawda", "Fałsz"].map((label) => {
                              const val = label === "Prawda";
                              const isSelected = userVal === val;
                              const isCorrectChoice =
                                submitted && correctVal === val;
                              const isWrongChoice =
                                submitted && isSelected && correctVal !== val;

                              let borderColor = theme.border;
                              let backgroundColor = "transparent";
                              let textColor = theme.textSecondary;

                              if (submitted) {
                                if (isCorrectChoice) {
                                  borderColor = colors.brand[500];
                                  backgroundColor = colors.brand[500] + "1A";
                                  textColor = colors.brand[600];
                                } else if (isWrongChoice) {
                                  borderColor = colors.red[500];
                                  backgroundColor = colors.red[500] + "1A";
                                  textColor = colors.red[600];
                                }
                              } else if (isSelected) {
                                borderColor = colors.brand[500];
                                backgroundColor = colors.brand[500] + "1A";
                                textColor = colors.brand[600];
                              }

                              return (
                                <TouchableOpacity
                                  key={label}
                                  disabled={submitted}
                                  onPress={() => {
                                    if (submitted) return;
                                    const n = [...ans];
                                    n[i] = val;
                                    setSelectedAnswer(n);
                                  }}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    borderRadius: 16,
                                    borderWidth: 2,
                                    alignItems: "center",
                                    borderColor,
                                    backgroundColor,
                                  }}
                                >
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    {submitted && isCorrectChoice && (
                                      <Ionicons
                                        name="checkmark-circle"
                                        size={14}
                                        color={colors.brand[500]}
                                      />
                                    )}
                                    {submitted && isWrongChoice && (
                                      <Ionicons
                                        name="close-circle"
                                        size={14}
                                        color={colors.red[500]}
                                      />
                                    )}
                                    <Text
                                      style={{
                                        fontSize: 14,
                                        fontFamily: "Outfit_500Medium",
                                        color: textColor,
                                      }}
                                    >
                                      {label}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {/* Poprawna odpowiedź pod stwierdzeniem gdy user się pomylił */}
                          {submitted &&
                            isWrongStatement &&
                            correctVal !== null && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color: colors.brand[600],
                                  marginTop: 6,
                                }}
                              >
                                Poprawna: {correctVal ? "Prawda" : "Fałsz"}
                              </Text>
                            )}
                        </Card>
                      );
                    })}
                  </View>
                );
              })()}

            {/* OPEN / ESSAY */}
            {(question.type === "OPEN" || question.type === "ESSAY") && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                    Twoja odpowiedź zostanie oceniona przez sztuczną
                    inteligencję
                  </Text>
                </View>

                {/* Hints */}
                {content.hints && content.hints.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    {content.hints.map((h: string, i: number) => (
                      <View
                        key={i}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 10,
                          backgroundColor: isDark ? "#0c4a6e20" : "#f0f9ff",
                          borderWidth: 1,
                          borderColor: isDark ? "#0c4a6e50" : "#bae6fd",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: isDark ? "#38bdf8" : "#0284c7",
                          }}
                        >
                          💡 {h}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Instruction */}
                {content.instruction && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: theme.textSecondary,
                      fontStyle: "italic",
                      marginBottom: 12,
                      lineHeight: 21,
                    }}
                  >
                    {content.instruction}
                  </Text>
                )}

                {/* Quote / sentencja */}
                {content.quote && (
                  <View
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      backgroundColor: isDark ? "#5b21b615" : "#f5f3ff",
                      borderWidth: 1,
                      borderColor: isDark ? "#5b21b640" : "#ddd6fe",
                      marginBottom: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontStyle: "italic",
                        fontWeight: "500",
                        color: isDark ? "#c4b5fd" : "#5b21b6",
                        lineHeight: 22,
                        textAlign: "center",
                      }}
                    >
                      „{content.quote}"
                    </Text>
                  </View>
                )}

                {/* Slogan / hasło */}
                {content.slogan && !content.quote && (
                  <View
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: isDark ? "#5b21b615" : "#f5f3ff",
                      borderWidth: 1,
                      borderColor: isDark ? "#5b21b640" : "#ddd6fe",
                      marginBottom: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? "#a78bfa" : "#7c3aed",
                        marginBottom: 4,
                      }}
                    >
                      Hasło:
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: isDark ? "#c4b5fd" : "#5b21b6",
                      }}
                    >
                      „{content.slogan}"
                    </Text>
                  </View>
                )}

                {/* Zdanie do przekształcenia */}
                {content.originalSentence && (
                  <View
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      backgroundColor: isDark ? "#0c4a6e15" : "#f0f9ff",
                      borderWidth: 1,
                      borderColor: isDark ? "#0c4a6e40" : "#bae6fd",
                      marginBottom: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? "#38bdf8" : "#0284c7",
                        marginBottom: 4,
                      }}
                    >
                      Zdanie:
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: isDark ? "#bae6fd" : "#0c4a6e",
                      }}
                    >
                      „{content.originalSentence}"
                    </Text>
                    {content.transformation && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDark ? "#7dd3fc" : "#0369a1",
                          fontStyle: "italic",
                          marginTop: 6,
                        }}
                      >
                        → {content.transformation}
                      </Text>
                    )}
                  </View>
                )}

                {/* Zdanie do oceny */}
                {content.statement && !content.originalSentence && (
                  <View
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      backgroundColor: theme.inputBg,
                      borderWidth: 1,
                      borderColor: theme.border,
                      marginBottom: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textTertiary,
                        marginBottom: 4,
                      }}
                    >
                      Zdanie do oceny:
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: theme.text,
                      }}
                    >
                      „{content.statement}"
                    </Text>
                  </View>
                )}

                {/* Frazeologizm */}
                {content.phrase && (
                  <View
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: isDark ? "#92400e15" : "#fffbeb",
                      borderWidth: 1,
                      borderColor: isDark ? "#92400e40" : "#fde68a",
                      marginBottom: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: isDark ? "#fbbf24" : "#d97706",
                        marginBottom: 4,
                      }}
                    >
                      Frazeologizm:
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: isDark ? "#fcd34d" : "#92400e",
                      }}
                    >
                      {content.phrase}
                    </Text>
                  </View>
                )}

                {/* Requirements */}
                {content.requirements && content.requirements.length > 0 && (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: isDark ? "#04785710" : "#ecfdf5",
                      borderWidth: 1,
                      borderColor: isDark ? "#04785740" : "#a7f3d0",
                      marginBottom: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isDark ? "#34d399" : "#047857",
                        marginBottom: 6,
                      }}
                    >
                      ✅ Wymagania:
                    </Text>
                    {content.requirements.map((r: string, i: number) => (
                      <Text
                        key={i}
                        style={{
                          fontSize: 12,
                          color: isDark ? "#6ee7b7" : "#065f46",
                          lineHeight: 19,
                        }}
                      >
                        • {r}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Words do użycia */}
                {content.words && content.words.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 14,
                    }}
                  >
                    {content.words.map((w: string, i: number) => (
                      <View
                        key={i}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 10,
                          backgroundColor: isDark ? "#92400e15" : "#fffbeb",
                          borderWidth: 1,
                          borderColor: isDark ? "#92400e40" : "#fde68a",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: isDark ? "#fbbf24" : "#92400e",
                          }}
                        >
                          {w}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Sugerowane lektury */}
                {content.suggestedWorks &&
                  content.suggestedWorks.length > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 14,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                        Sugerowane:
                      </Text>
                      {content.suggestedWorks.map((w: string, i: number) => (
                        <View
                          key={i}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 10,
                            backgroundColor: isDark ? "#5b21b615" : "#f3e8ff",
                            borderWidth: 1,
                            borderColor: isDark ? "#5b21b640" : "#ddd6fe",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "500",
                              color: isDark ? "#a78bfa" : "#7c3aed",
                            }}
                          >
                            📚 {w}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                {/* Word limit */}
                {content.wordLimit && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.textTertiary,
                      marginBottom: 8,
                    }}
                  >
                    📝 Limit:{" "}
                    {typeof content.wordLimit === "object"
                      ? `${content.wordLimit.min}–${content.wordLimit.max} słów`
                      : `do ${content.wordLimit} słów`}
                  </Text>
                )}

                {needsMathEditor && !submitted ? (
                  <MathEditor
                    value={openAnswer}
                    onChange={setOpenAnswer}
                    placeholder={
                      question.type === "ESSAY"
                        ? "Napisz odpowiedź z wzorami..."
                        : "Wpisz odpowiedź..."
                    }
                    taskType="math_short_calc"
                  />
                ) : (
                  <TextInput
                    value={openAnswer}
                    onChangeText={setOpenAnswer}
                    multiline
                    numberOfLines={6}
                    editable={!submitted}
                    placeholder="Wpisz odpowiedź..."
                    placeholderTextColor={theme.textTertiary}
                    style={{
                      backgroundColor: theme.inputBg,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 16,
                      padding: spacing[4],
                      fontSize: 15,
                      fontFamily: "DMSans_400Regular",
                      color: theme.text,
                      textAlignVertical: "top",
                      minHeight: 150,
                    }}
                  />
                )}
                {(() => {
                  const text = openAnswer || "";
                  const wordCount = text.trim()
                    ? text.trim().split(/\s+/).length
                    : 0;
                  const minWords = content.wordLimit
                    ? typeof content.wordLimit === "object"
                      ? content.wordLimit.min
                      : content.wordLimit
                    : null;
                  const maxWords =
                    content.wordLimit && typeof content.wordLimit === "object"
                      ? content.wordLimit.max
                      : null;
                  const underMin = minWords && wordCount < minWords;
                  const overMax = maxWords && wordCount > maxWords;
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        marginTop: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "500",
                          fontVariant: ["tabular-nums"],
                          color: overMax
                            ? colors.red[500]
                            : underMin
                              ? colors.red[400]
                              : theme.textTertiary,
                        }}
                      >
                        {wordCount}{" "}
                        {minWords
                          ? `/ ${minWords}${maxWords ? `–${maxWords}` : ""}`
                          : ""}{" "}
                        słów
                      </Text>
                    </View>
                  );
                })()}
                {submitted && content.sampleAnswer && (
                  <View
                    style={{
                      marginTop: 12,
                      backgroundColor: colors.brand[500] + "10",
                      borderRadius: 12,
                      padding: 14,
                      borderLeftWidth: 3,
                      borderLeftColor: colors.brand[500],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: colors.brand[600],
                        marginBottom: 4,
                      }}
                    >
                      Przykładowa odpowiedź:
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.text,
                        lineHeight: 20,
                      }}
                    >
                      {parseChemText(content.sampleAnswer)}
                    </Text>
                  </View>
                )}
                {submitted && content.rubric && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.textTertiary,
                      fontStyle: "italic",
                      marginTop: 6,
                    }}
                  >
                    Kryteria: {content.rubric}
                  </Text>
                )}
              </>
            )}

            {/* MATCHING */}
            {question.type === "MATCHING" &&
              content.pairs &&
              (() => {
                const pairs = content.pairs as {
                  left: string;
                  right: string;
                }[];
                const shuffledRight = matchingShuffledRight;

                const answers =
                  (Array.isArray(selectedAnswer)
                    ? {}
                    : (selectedAnswer as any)) || {};
                const setMatch = (left: string, right: string) => {
                  if (submitted) return;
                  setSelectedAnswer({ ...answers, [left]: right } as any);
                };
                const usedValues = new Set(Object.values(answers));
                return (
                  <View style={{ gap: 14 }}>
                    {pairs.map((pair: any) => {
                      const userVal = (answers as any)[pair.left] || "";
                      const isCorrect = submitted && userVal === pair.right;
                      const isWrong =
                        submitted && userVal && userVal !== pair.right;
                      return (
                        <View key={pair.left}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "600",
                              color: theme.text,
                              marginBottom: 6,
                            }}
                          >
                            {pair.left}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 6,
                            }}
                          >
                            {shuffledRight.map((right: string) => {
                              const isThis = userVal === right;
                              const taken = usedValues.has(right) && !isThis;
                              const isCorrectOption = right === pair.right;
                              const showCorrect = submitted && isCorrectOption;
                              const showWrong =
                                submitted && isThis && !isCorrectOption;
                              return (
                                <TouchableOpacity
                                  key={right}
                                  onPress={() =>
                                    !taken && setMatch(pair.left, right)
                                  }
                                  disabled={submitted || taken}
                                  style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    borderRadius: 14,
                                    borderWidth: 2,
                                    borderColor: submitted
                                      ? showCorrect
                                        ? colors.brand[500]
                                        : showWrong
                                          ? colors.red[500]
                                          : theme.border
                                      : isThis
                                        ? colors.brand[500]
                                        : theme.border,
                                    backgroundColor: submitted
                                      ? showCorrect
                                        ? colors.brand[500] + "15"
                                        : showWrong
                                          ? colors.red[500] + "15"
                                          : "transparent"
                                      : isThis
                                        ? colors.brand[500] + "15"
                                        : "transparent",
                                    opacity:
                                      submitted &&
                                      !showCorrect &&
                                      !showWrong &&
                                      !isThis
                                        ? 0.3
                                        : 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: "500",
                                      color: submitted
                                        ? showCorrect
                                          ? colors.brand[600]
                                          : showWrong
                                            ? colors.red[600]
                                            : theme.textTertiary
                                        : isThis
                                          ? colors.brand[600]
                                          : theme.textSecondary,
                                    }}
                                  >
                                    {right}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {submitted && isWrong && (
                            <Text
                              style={{
                                fontSize: 11,
                                color: colors.brand[600],
                                marginTop: 4,
                              }}
                            >
                              Poprawna: {pair.right}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

            {/* CLOZE */}
            {question.type === "CLOZE" &&
              content.template &&
              (() => {
                const ans =
                  typeof selectedAnswer === "object" &&
                  selectedAnswer &&
                  !Array.isArray(selectedAnswer)
                    ? (selectedAnswer as Record<string, string>)
                    : {};
                const parts = content.template.split(
                  /(\{\{[^}]+\}\}|\(\d+\))/g,
                );
                return (
                  <View>
                    {content.instruction && (
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: theme.text,
                          marginBottom: 12,
                        }}
                      >
                        {content.instruction}
                      </Text>
                    )}
                    <View
                      style={{
                        backgroundColor: theme.inputBg,
                        borderWidth: 1,
                        borderColor: theme.border,
                        borderRadius: 16,
                        padding: 14,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {parts.map((part: string, i: number) => {
                          const match =
                            part.match(/\{\{(\w+)\}\}/) ||
                            part.match(/\((\d+)\)/);
                          if (!match) {
                            return (
                              <Text
                                key={i}
                                style={{
                                  fontSize: 15,
                                  color: theme.text,
                                  lineHeight: 28,
                                }}
                              >
                                {part}
                              </Text>
                            );
                          }
                          const rawId = match[1];
                          const blankId = /^\d+$/.test(rawId)
                            ? `b${rawId}`
                            : rawId;

                          const blank = content.blanks?.[blankId];
                          const userVal = (ans[blankId] || "")
                            .trim()
                            .toLowerCase();
                          const isOk =
                            submitted &&
                            blank?.acceptedAnswers?.some(
                              (a: string) => a.toLowerCase().trim() === userVal,
                            );
                          return (
                            <View
                              key={i}
                              style={{ marginHorizontal: 4, marginVertical: 2 }}
                            >
                              <TextInput
                                value={
                                  submitted &&
                                  !isOk &&
                                  blank?.acceptedAnswers?.[0]
                                    ? blank.acceptedAnswers[0]
                                    : ans[blankId] || ""
                                }
                                onChangeText={(text) =>
                                  !submitted &&
                                  setSelectedAnswer({ ...ans, [blankId]: text })
                                }
                                editable={!submitted}
                                placeholder="..."
                                placeholderTextColor={theme.textTertiary}
                                style={{
                                  minWidth: 90,
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  fontSize: 14,
                                  fontWeight:
                                    submitted &&
                                    !isOk &&
                                    blank?.acceptedAnswers?.[0]
                                      ? "600"
                                      : undefined,
                                  borderBottomWidth: 2,
                                  backgroundColor: "transparent",
                                  color:
                                    submitted &&
                                    !isOk &&
                                    blank?.acceptedAnswers?.[0]
                                      ? colors.brand[600]
                                      : theme.text,
                                  textAlign: "center",
                                  borderBottomColor: submitted
                                    ? isOk || blank?.acceptedAnswers?.[0]
                                      ? colors.brand[500]
                                      : colors.red[500]
                                    : colors.navy[400],
                                }}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })()}

            {/* FILL_IN */}
            {question.type === "FILL_IN" &&
              content.blanks &&
              (() => {
                const ans =
                  typeof selectedAnswer === "object" &&
                  selectedAnswer &&
                  !Array.isArray(selectedAnswer)
                    ? (selectedAnswer as Record<string, string>)
                    : {};
                const blanks = Array.isArray(content.blanks)
                  ? content.blanks
                  : Object.entries(content.blanks).map(
                      ([id, b]: [string, any]) => ({ id, ...b }),
                    );
                return (
                  <View style={{ gap: 12 }}>
                    {blanks.map((b: any, i: number) => {
                      const userVal = (ans[b.id] || "").trim().toLowerCase();
                      const isOk =
                        submitted &&
                        b.acceptedAnswers?.some(
                          (a: string) => a.toLowerCase().trim() === userVal,
                        );
                      return (
                        <View key={b.id}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "500",
                              color: theme.text,
                              marginBottom: 4,
                            }}
                          >
                            {b.label || b.hint || b.baseWord
                              ? `${i + 1}. ${b.label || b.hint || b.baseWord}`
                              : `Luka ${i + 1}`}
                          </Text>
                          <TextInput
                            value={
                              submitted && !isOk && b.acceptedAnswers?.[0]
                                ? b.acceptedAnswers[0]
                                : ans[b.id] || ""
                            }
                            onChangeText={(text) =>
                              !submitted &&
                              setSelectedAnswer({ ...ans, [b.id]: text })
                            }
                            editable={!submitted}
                            placeholder="Wpisz odpowiedź..."
                            placeholderTextColor={theme.textTertiary}
                            style={{
                              backgroundColor: theme.inputBg,
                              borderWidth: 1,
                              borderColor: submitted
                                ? isOk || b.acceptedAnswers?.[0]
                                  ? colors.brand[500]
                                  : colors.red[500]
                                : theme.border,
                              color:
                                submitted && !isOk && b.acceptedAnswers?.[0]
                                  ? colors.brand[600]
                                  : theme.text,
                              fontWeight:
                                submitted && !isOk && b.acceptedAnswers?.[0]
                                  ? "600"
                                  : undefined,
                            }}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

            {/* GRAPH_INTERPRET */}
            {question.type === "GRAPH_INTERPRET" &&
              (() => {
                const ans =
                  typeof selectedAnswer === "object" &&
                  selectedAnswer &&
                  !Array.isArray(selectedAnswer)
                    ? (selectedAnswer as Record<string, string>)
                    : {};
                return (
                  <View style={{ gap: 16 }}>
                    {content.graphSvg && (
                      <SvgViewer svg={content.graphSvg} theme={theme} />
                    )}
                    {content.graph && !content.graphSvg && (
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
                    )}
                    {content.subQuestions?.map((sq: any, sqIdx: number) => {
                      const userVal = (ans[sq.id] || "").trim().toLowerCase();
                      const deterministicOk =
                        submitted &&
                        sq.acceptedAnswers?.some(
                          (a: string) => a.toLowerCase().trim() === userVal,
                        );
                      const aiOk =
                        submitted &&
                        result?.aiGrading?.subQuestions?.[sq.id]?.score >= 0.5;
                      const isOk = deterministicOk || aiOk;
                      return (
                        <View key={sq.id}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "500",
                              color: theme.text,
                              marginBottom: 4,
                            }}
                          >
                            {sq.text}
                          </Text>
                          {needsMathEditor && !submitted ? (
                            <MathEditor
                              value={ans[sq.id] || ""}
                              onChange={(text) =>
                                setSelectedAnswer({ ...ans, [sq.id]: text })
                              }
                              placeholder="Odpowiedź..."
                              taskType="math_short_calc"
                              showExample={sqIdx === 0}
                            />
                          ) : (
                            <TextInput
                              value={
                                submitted &&
                                !isOk &&
                                !result?.aiGrading?.subQuestions?.[sq.id] &&
                                sq.acceptedAnswers?.[0]
                                  ? sq.acceptedAnswers[0]
                                  : ans[sq.id] || ""
                              }
                              onChangeText={(text) =>
                                !submitted &&
                                setSelectedAnswer({ ...ans, [sq.id]: text })
                              }
                              editable={!submitted}
                              placeholder="Odpowiedź..."
                              placeholderTextColor={theme.textTertiary}
                              style={{
                                backgroundColor: theme.inputBg,
                                borderWidth: 1,
                                borderColor: submitted
                                  ? isOk ||
                                    (!result?.aiGrading?.subQuestions?.[
                                      sq.id
                                    ] &&
                                      sq.acceptedAnswers?.[0])
                                    ? colors.brand[500]
                                    : colors.red[500]
                                  : theme.border,

                                borderRadius: 12,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                fontSize: 14,
                                color:
                                  submitted &&
                                  !isOk &&
                                  !result?.aiGrading?.subQuestions?.[sq.id] &&
                                  sq.acceptedAnswers?.[0]
                                    ? colors.brand[600]
                                    : theme.text,
                                fontWeight:
                                  submitted &&
                                  !isOk &&
                                  !result?.aiGrading?.subQuestions?.[sq.id] &&
                                  sq.acceptedAnswers?.[0]
                                    ? "600"
                                    : undefined,
                              }}
                            />
                          )}
                          {submitted &&
                            result?.aiGrading?.subQuestions?.[sq.id] && (
                              <View
                                style={{
                                  marginTop: 6,
                                  padding: 10,
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor:
                                    result.aiGrading.subQuestions[sq.id]
                                      .score >= 0.5
                                      ? colors.brand[500]
                                      : colors.red[500],
                                  backgroundColor:
                                    result.aiGrading.subQuestions[sq.id]
                                      .score >= 0.5
                                      ? colors.brand[500] + "10"
                                      : colors.red[500] + "10",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color:
                                      result.aiGrading.subQuestions[sq.id]
                                        .score >= 0.5
                                        ? colors.brand[600]
                                        : colors.red[600],
                                  }}
                                >
                                  {result.aiGrading.subQuestions[sq.id].score >=
                                  0.5
                                    ? "✅"
                                    : "❌"}{" "}
                                  Ocena AI
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: theme.textSecondary,
                                    marginTop: 2,
                                  }}
                                >
                                  {
                                    result.aiGrading.subQuestions[sq.id]
                                      .feedback
                                  }
                                </Text>
                              </View>
                            )}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

            {/* TABLE_DATA */}
            {question.type === "TABLE_DATA" &&
              content.table &&
              (() => {
                const ans =
                  typeof selectedAnswer === "object" &&
                  selectedAnswer &&
                  !Array.isArray(selectedAnswer)
                    ? (selectedAnswer as Record<string, string>)
                    : {};
                return (
                  <View style={{ gap: 16 }}>
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
                          style={{
                            flexDirection: "row",
                            backgroundColor: theme.inputBg,
                          }}
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
                                minWidth: 70,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "700",
                                  color: theme.text,
                                }}
                              >
                                {h}
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
                                  minWidth: 70,
                                }}
                              >
                                <Text
                                  style={{ fontSize: 12, color: theme.text }}
                                >
                                  {cell}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                    {content.subQuestions?.map((sq: any, sqIdx: number) => {
                      const userVal = (ans[sq.id] || "").trim().toLowerCase();
                      const deterministicOk =
                        submitted &&
                        sq.acceptedAnswers?.some(
                          (a: string) => a.toLowerCase().trim() === userVal,
                        );
                      const aiOk =
                        submitted &&
                        result?.aiGrading?.subQuestions?.[sq.id]?.score >= 0.5;
                      const isOk = deterministicOk || aiOk;
                      return (
                        <View key={sq.id}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "500",
                              color: theme.text,
                              marginBottom: 4,
                            }}
                          >
                            {sq.text}
                          </Text>
                          {needsMathEditor && !submitted ? (
                            <MathEditor
                              value={ans[sq.id] || ""}
                              onChange={(text) =>
                                setSelectedAnswer({ ...ans, [sq.id]: text })
                              }
                              placeholder="Odpowiedź..."
                              taskType="math_short_calc"
                              showExample={sqIdx === 0}
                            />
                          ) : (
                            <TextInput
                              value={
                                submitted &&
                                !isOk &&
                                !result?.aiGrading?.subQuestions?.[sq.id] &&
                                sq.acceptedAnswers?.[0]
                                  ? sq.acceptedAnswers[0]
                                  : ans[sq.id] || ""
                              }
                              onChangeText={(text) =>
                                !submitted &&
                                setSelectedAnswer({ ...ans, [sq.id]: text })
                              }
                              editable={!submitted}
                              placeholder="Odpowiedź..."
                              placeholderTextColor={theme.textTertiary}
                              style={{
                                backgroundColor: theme.inputBg,
                                borderWidth: 1,
                                borderColor: submitted
                                  ? isOk ||
                                    (!result?.aiGrading?.subQuestions?.[
                                      sq.id
                                    ] &&
                                      sq.acceptedAnswers?.[0])
                                    ? colors.brand[500]
                                    : colors.red[500]
                                  : theme.border,
                                borderRadius: 12,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                fontSize: 14,
                                color:
                                  submitted &&
                                  !isOk &&
                                  !result?.aiGrading?.subQuestions?.[sq.id] &&
                                  sq.acceptedAnswers?.[0]
                                    ? colors.brand[600]
                                    : theme.text,
                                fontWeight:
                                  submitted &&
                                  !isOk &&
                                  !result?.aiGrading?.subQuestions?.[sq.id] &&
                                  sq.acceptedAnswers?.[0]
                                    ? "600"
                                    : undefined,
                              }}
                            />
                          )}
                          {submitted &&
                            result?.aiGrading?.subQuestions?.[sq.id] && (
                              <View
                                style={{
                                  marginTop: 6,
                                  padding: 10,
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor:
                                    result.aiGrading.subQuestions[sq.id]
                                      .score >= 0.5
                                      ? colors.brand[500]
                                      : colors.red[500],
                                  backgroundColor:
                                    result.aiGrading.subQuestions[sq.id]
                                      .score >= 0.5
                                      ? colors.brand[500] + "10"
                                      : colors.red[500] + "10",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color:
                                      result.aiGrading.subQuestions[sq.id]
                                        .score >= 0.5
                                        ? colors.brand[600]
                                        : colors.red[600],
                                  }}
                                >
                                  {result.aiGrading.subQuestions[sq.id].score >=
                                  0.5
                                    ? "✅"
                                    : "❌"}{" "}
                                  Ocena AI
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: theme.textSecondary,
                                    marginTop: 2,
                                  }}
                                >
                                  {
                                    result.aiGrading.subQuestions[sq.id]
                                      .feedback
                                  }
                                </Text>
                              </View>
                            )}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

            {/* ERROR_FIND */}
            {question.type === "ERROR_FIND" && content.steps && (
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Kliknij krok z błędem
                </Text>
                {content.steps.map((s: any) => {
                  const sel = selectedAnswer === s.id;
                  const isCorrectStep =
                    submitted && s.id === content.correctErrorStep;
                  const isWrongPick =
                    submitted && sel && s.id !== content.correctErrorStep;

                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() =>
                        !submitted &&
                        setSelectedAnswer(selectedAnswer === s.id ? null : s.id)
                      }
                      disabled={submitted}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: isCorrectStep
                          ? colors.brand[500]
                          : isWrongPick
                            ? colors.red[500]
                            : sel
                              ? colors.navy[500]
                              : theme.border,
                        backgroundColor: isCorrectStep
                          ? colors.brand[500] + "20"
                          : isWrongPick
                            ? colors.red[500] + "20"
                            : sel
                              ? colors.navy[500] + "15"
                              : "transparent",
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isCorrectStep
                            ? colors.brand[500]
                            : isWrongPick
                              ? colors.red[500]
                              : sel
                                ? colors.navy[500]
                                : theme.inputBg,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color:
                              isCorrectStep || isWrongPick || sel
                                ? "#fff"
                                : theme.textSecondary,
                          }}
                        >
                          {s.id}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            color: theme.text,
                            lineHeight: 22,
                          }}
                        >
                          {s.text}
                        </Text>
                        {isCorrectStep && (
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: colors.brand[500],
                              marginTop: 4,
                            }}
                          >
                            ✓ Tu jest błąd
                          </Text>
                        )}
                        {isWrongPick && (
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: colors.red[500],
                              marginTop: 4,
                            }}
                          >
                            ✗ Twój wybór
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ORDERING / PROOF_ORDER */}
            {(question.type === "ORDERING" ||
              question.type === "PROOF_ORDER") &&
              (() => {
                const items =
                  question.type === "ORDERING" ? content.items : content.steps;
                if (!items) return null;
                const ord = Array.isArray(selectedAnswer)
                  ? selectedAnswer
                  : question.type === "ORDERING"
                    ? items.map((_: any, i: number) => i)
                    : items.map((s: any) => s.id);
                if (!Array.isArray(selectedAnswer)) {
                  setTimeout(() => setSelectedAnswer(ord), 0);
                }
                const mv = (i: number, d: -1 | 1) => {
                  if (submitted) return;
                  const n = [...ord];
                  [n[i], n[i + d]] = [n[i + d], n[i]];
                  setSelectedAnswer(n);
                };
                const getLabel = (idx: any) => {
                  if (question.type === "ORDERING") return items[idx] || "";
                  const step = items.find((s: any) => s.id === idx);
                  return step?.text || "";
                };

                const correctOrder: any[] = submitted
                  ? result?.correctAnswer || content.correctOrder
                  : [];
                const anyWrong =
                  submitted &&
                  correctOrder.some((v: any, i: number) => v !== ord[i]);

                return (
                  <View style={{ gap: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      Ustaw w poprawnej kolejności
                    </Text>

                    {ord.map((idx: any, i: number) => {
                      const isCorrectPos = submitted && correctOrder[i] === idx;
                      const isWrongPos = submitted && correctOrder[i] !== idx;
                      // która pozycja jest poprawna dla tego elementu
                      const shouldBeAt = submitted
                        ? correctOrder.indexOf(idx)
                        : -1;

                      return (
                        <View
                          key={i}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            padding: 12,
                            borderRadius: 14,
                            borderWidth: submitted ? 2 : 0,
                            borderColor: isCorrectPos
                              ? colors.brand[500]
                              : isWrongPos
                                ? colors.red[500]
                                : "transparent",
                            backgroundColor: isCorrectPos
                              ? colors.brand[500] + "15"
                              : isWrongPos
                                ? colors.red[500] + "12"
                                : theme.inputBg,
                          }}
                        >
                          {/* Numer pozycji */}
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              width: 22,
                              color: isCorrectPos
                                ? colors.brand[600]
                                : isWrongPos
                                  ? colors.red[500]
                                  : theme.textTertiary,
                            }}
                          >
                            {i + 1}.
                          </Text>

                          {/* Treść elementu */}
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: theme.text,
                              lineHeight: 20,
                            }}
                          >
                            {getLabel(idx)}
                          </Text>

                          {/* Po submicie: ikona + hint gdzie powinno być */}
                          {isCorrectPos && (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={colors.brand[500]}
                            />
                          )}
                          {isWrongPos && (
                            <View style={{ alignItems: "flex-end", gap: 2 }}>
                              <Ionicons
                                name="close-circle"
                                size={18}
                                color={colors.red[500]}
                              />
                              <Text
                                style={{
                                  fontSize: 9,
                                  color: colors.red[400],
                                  fontWeight: "600",
                                }}
                              >
                                → poz. {shouldBeAt + 1}
                              </Text>
                            </View>
                          )}

                          {/* Przed submitem: strzałki */}
                          {!submitted && (
                            <View style={{ flexDirection: "row", gap: 2 }}>
                              <TouchableOpacity
                                onPress={() => i > 0 && mv(i, -1)}
                                disabled={i === 0}
                                style={{
                                  padding: 6,
                                  opacity: i === 0 ? 0.3 : 1,
                                }}
                              >
                                <Ionicons
                                  name="chevron-up"
                                  size={18}
                                  color={theme.textSecondary}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => i < ord.length - 1 && mv(i, 1)}
                                disabled={i === ord.length - 1}
                                style={{
                                  padding: 6,
                                  opacity: i === ord.length - 1 ? 0.3 : 1,
                                }}
                              >
                                <Ionicons
                                  name="chevron-down"
                                  size={18}
                                  color={theme.textSecondary}
                                />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            {/* WIAZKA */}
            {question.type === "WIAZKA" &&
              content.subQuestions &&
              (() => {
                const ans =
                  typeof selectedAnswer === "object" &&
                  selectedAnswer &&
                  !Array.isArray(selectedAnswer)
                    ? (selectedAnswer as Record<string, any>)
                    : {};
                const set = (id: string, v: any) => {
                  if (submitted) return;
                  setSelectedAnswer({ ...ans, [id]: v });
                };
                const firstOpenIdx = content.subQuestions.findIndex(
                  (sq: any) => sq.type === "OPEN",
                );
                return (
                  <View style={{ gap: 16 }}>
                    {content.subQuestions.map((sq: any, i: number) => (
                      <View
                        key={sq.id}
                        style={{
                          backgroundColor: theme.inputBg,
                          borderRadius: 16,
                          padding: 14,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: theme.text,
                            marginBottom: 10,
                          }}
                        >
                          {String.fromCharCode(97 + i)}) {sq.text}
                        </Text>
                        {sq.type === "CLOSED" && sq.options && (
                          <View style={{ gap: 6 }}>
                            {sq.options.map((o: any) => (
                              <OptionCard
                                key={o.id}
                                id={o.id}
                                text={parseChemText(o.text)}
                                state={
                                  !submitted
                                    ? ans[sq.id] === o.id
                                      ? "selected"
                                      : "default"
                                    : o.id === sq.correctAnswer
                                      ? "correct"
                                      : ans[sq.id] === o.id
                                        ? "wrong"
                                        : "default"
                                }
                                onPress={() => set(sq.id, o.id)}
                                disabled={submitted}
                              />
                            ))}
                          </View>
                        )}
                        {sq.type === "TRUE_FALSE" && sq.statements && (
                          <View style={{ gap: 6 }}>
                            {sq.statements.map((st: any, si: number) => {
                              const sa =
                                (ans[sq.id] as boolean[]) ||
                                sq.statements.map(() => null);
                              return (
                                <View
                                  key={si}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingVertical: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      flex: 1,
                                      fontSize: 12,
                                      color: theme.text,
                                    }}
                                  >
                                    {st.text}
                                  </Text>
                                  <View
                                    style={{ flexDirection: "row", gap: 4 }}
                                  >
                                    {["P", "F"].map((label) => {
                                      const val = label === "P";
                                      const isThis = sa[si] === val;
                                      return (
                                        <TouchableOpacity
                                          key={label}
                                          onPress={() => {
                                            const n = [...sa];
                                            n[si] = val;
                                            set(sq.id, n);
                                          }}
                                          disabled={submitted}
                                          style={{
                                            paddingHorizontal: 10,
                                            paddingVertical: 6,
                                            borderRadius: 10,
                                            backgroundColor: isThis
                                              ? val
                                                ? colors.brand[500]
                                                : colors.red[500]
                                              : theme.card,
                                            borderWidth: 1,
                                            borderColor: theme.border,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 12,
                                              fontWeight: "600",
                                              color: isThis
                                                ? "#fff"
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
                              );
                            })}
                          </View>
                        )}
                        {sq.type === "OPEN" && (
                          <>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                marginBottom: 6,
                              }}
                            ></View>

                            {needsMathEditor && !submitted ? (
                              <MathEditor
                                value={ans[sq.id] || ""}
                                onChange={(text) => set(sq.id, text)}
                                placeholder="Odpowiedź..."
                                taskType="math_short_calc"
                                showExample={i === firstOpenIdx}
                              />
                            ) : (
                              <TextInput
                                value={ans[sq.id] || ""}
                                onChangeText={(text) => set(sq.id, text)}
                                editable={!submitted}
                                multiline
                                placeholder="Odpowiedź..."
                                placeholderTextColor={theme.textTertiary}
                                style={{
                                  backgroundColor: theme.card,
                                  borderWidth: 1,
                                  borderColor: theme.border,
                                  borderRadius: 12,
                                  padding: 10,
                                  fontSize: 13,
                                  color: theme.text,
                                  minHeight: 60,
                                  textAlignVertical: "top",
                                }}
                              />
                            )}
                            {submitted &&
                              result?.aiGrading?.subQuestions?.[sq.id] && (
                                <View
                                  style={{
                                    marginTop: 8,
                                    padding: 12,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor:
                                      result.aiGrading.subQuestions[sq.id]
                                        .score >= 0.5
                                        ? colors.brand[500]
                                        : colors.red[500],
                                    backgroundColor:
                                      result.aiGrading.subQuestions[sq.id]
                                        .score >= 0.5
                                        ? colors.brand[500] + "10"
                                        : colors.red[500] + "10",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: "700",
                                      color:
                                        result.aiGrading.subQuestions[sq.id]
                                          .score >= 0.5
                                          ? colors.brand[600]
                                          : colors.red[600],
                                      marginBottom: 4,
                                    }}
                                  >
                                    {result.aiGrading.subQuestions[sq.id]
                                      .score >= 0.5
                                      ? "✅"
                                      : "❌"}{" "}
                                    {result.aiGrading.subQuestions[sq.id]
                                      .pointsEarned ?? 0}
                                    /{sq.points || 1} pkt
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: theme.textSecondary,
                                      lineHeight: 18,
                                    }}
                                  >
                                    {
                                      result.aiGrading.subQuestions[sq.id]
                                        .feedback
                                    }
                                  </Text>
                                </View>
                              )}
                            {submitted &&
                              sq.type === "OPEN" &&
                              !result?.aiGrading?.subQuestions?.[sq.id] &&
                              !ans[sq.id]?.trim() && (
                                <View
                                  style={{
                                    marginTop: 8,
                                    padding: 12,
                                    borderRadius: 12,
                                    backgroundColor: colors.red[500] + "10",
                                    borderWidth: 1,
                                    borderColor: colors.red[500],
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: "700",
                                      color: colors.red[600],
                                    }}
                                  >
                                    ❌ 0/{sq.points || 1} pkt — Brak odpowiedzi
                                  </Text>
                                </View>
                              )}
                            {submitted && sq.sampleAnswer && (
                              <View
                                style={{
                                  marginTop: 8,
                                  backgroundColor: colors.brand[500] + "10",
                                  borderRadius: 12,
                                  padding: 12,
                                  borderLeftWidth: 3,
                                  borderLeftColor: colors.brand[500],
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color: colors.brand[600],
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 4,
                                  }}
                                >
                                  Wzorcowa odpowiedź:
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: theme.text,
                                    lineHeight: 19,
                                  }}
                                >
                                  {sq.sampleAnswer}
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                        {sq.type === "MULTI_SELECT" && sq.options && (
                          <View style={{ gap: 6 }}>
                            {sq.options.map((o: any) => {
                              const sel = Array.isArray(ans[sq.id])
                                ? ans[sq.id]
                                : [];
                              const isSelected = sel.includes(o.id);
                              const isCorrectOpt = sq.correctAnswers?.includes(
                                o.id,
                              );
                              return (
                                <OptionCard
                                  key={o.id}
                                  id={o.id}
                                  text={parseChemText(o.text)}
                                  state={
                                    !submitted
                                      ? isSelected
                                        ? "selected"
                                        : "default"
                                      : isCorrectOpt
                                        ? "correct"
                                        : isSelected
                                          ? "wrong"
                                          : "default"
                                  }
                                  onPress={() => {
                                    if (submitted) return;
                                    const prev = Array.isArray(ans[sq.id])
                                      ? ans[sq.id]
                                      : [];
                                    set(
                                      sq.id,
                                      isSelected
                                        ? prev.filter((x: string) => x !== o.id)
                                        : [...prev, o.id],
                                    );
                                  }}
                                  disabled={submitted}
                                />
                              );
                            })}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })()}

            {/* CALCULATION */}
            {question.type === "CALCULATION" &&
              (() => {
                const givens = content.givens as
                  | { label: string; value: string }[]
                  | undefined;
                const formula = content.formula as string | undefined;
                const answer = content.answer as
                  | {
                      unit?: string;
                      tolerance?: number;
                      expectedValue?: number;
                    }
                  | undefined;
                const useMathEditor = !!content.showSteps;

                return (
                  <View style={{ gap: 16 }}>
                    {/* Dane */}
                    {givens && givens.length > 0 && (
                      <View
                        style={{
                          backgroundColor: theme.inputBg,
                          borderRadius: 14,
                          padding: 14,
                          borderWidth: 1,
                          borderColor: theme.border,
                          gap: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: theme.textTertiary,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 4,
                          }}
                        >
                          Dane
                        </Text>
                        {givens.map((g, i) => (
                          <View
                            key={i}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                color: theme.textSecondary,
                              }}
                            >
                              {parseChemText(g.label)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: theme.text,
                                fontFamily: "JetBrainsMono_400Regular",
                              }}
                            >
                              {g.value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Wzór */}
                    {formula && (
                      <View
                        style={{
                          backgroundColor: isDark ? "#5b21b615" : "#f3e8ff",
                          borderRadius: 14,
                          padding: 14,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: isDark ? "#c4b5fd" : "#7c3aed",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 4,
                          }}
                        >
                          Wzór
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: isDark ? "#c4b5fd" : "#5b21b6",
                            fontFamily: "JetBrainsMono_400Regular",
                          }}
                        >
                          {parseChemText(formula)}
                        </Text>
                      </View>
                    )}

                    {/* Pole odpowiedzi — MathEditor lub prosty input */}
                    {useMathEditor ? (
                      <MathEditor
                        value={openAnswer}
                        onChange={setOpenAnswer}
                        placeholder="Zapisz obliczenia i wynik..."
                        taskType="math_short_calc"
                      />
                    ) : (
                      <View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: theme.text,
                            marginBottom: 6,
                          }}
                        >
                          Twoja odpowiedź
                          {answer?.unit ? ` (${answer.unit})` : ""}:
                        </Text>
                        <TextInput
                          value={openAnswer}
                          onChangeText={setOpenAnswer}
                          editable={!submitted}
                          placeholder="Wpisz wynik..."
                          placeholderTextColor={theme.textTertiary}
                          keyboardType="numeric"
                          style={{
                            backgroundColor: theme.inputBg,
                            borderWidth: 2,
                            borderColor: submitted
                              ? result?.isCorrect
                                ? colors.brand[500]
                                : colors.red[500]
                              : theme.border,
                            borderRadius: 14,
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            fontSize: 18,
                            fontWeight: "700",
                            fontFamily: "JetBrainsMono_400Regular",
                            color: theme.text,
                            textAlign: "center",
                          }}
                        />
                      </View>
                    )}

                    {/* Po submicie — poprawna odpowiedź */}
                    {submitted && answer && (
                      <View
                        style={{
                          backgroundColor: colors.brand[500] + "10",
                          borderRadius: 12,
                          padding: 14,
                          borderLeftWidth: 3,
                          borderLeftColor: colors.brand[500],
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: colors.brand[600],
                            marginBottom: 4,
                          }}
                        >
                          Poprawna odpowiedź:
                        </Text>
                        <Text
                          style={{
                            fontSize: 20,
                            fontWeight: "700",
                            color: colors.brand[700],
                            fontFamily: "JetBrainsMono_400Regular",
                          }}
                        >
                          {answer.expectedValue}
                          {answer.unit ? ` ${answer.unit}` : ""}
                        </Text>
                        {answer.tolerance != null && answer.tolerance > 0 && (
                          <Text
                            style={{
                              fontSize: 11,
                              color: theme.textTertiary,
                              marginTop: 2,
                            }}
                          >
                            Tolerancja: ±{answer.tolerance}
                            {answer.unit ? ` ${answer.unit}` : ""}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}

            {/* EXPERIMENT_DESIGN */}
            {question.type === "EXPERIMENT_DESIGN" &&
              content.fields &&
              (() => {
                const ans =
                  typeof selectedAnswer === "object" &&
                  selectedAnswer &&
                  !Array.isArray(selectedAnswer)
                    ? (selectedAnswer as Record<string, string>)
                    : {};
                return (
                  <View style={{ gap: 14 }}>
                    {content.maxPoints && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: theme.textTertiary,
                          marginBottom: 2,
                        }}
                      >
                        Maks. punktów: {content.maxPoints}
                      </Text>
                    )}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                        Każde pole oceniane osobno przez AI
                      </Text>
                    </View>
                    {content.fields.map((field: any) => {
                      const userVal = (ans[field.id] || "").trim();
                      const hasAnswer = userVal.length > 0;
                      return (
                        <View key={field.id}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: theme.text,
                              }}
                            >
                              {field.label}
                            </Text>
                            {field.points && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: theme.textTertiary,
                                }}
                              >
                                {field.points}{" "}
                                {field.points === 1 ? "pkt" : "pkt"}
                              </Text>
                            )}
                          </View>
                          <TextInput
                            value={ans[field.id] || ""}
                            onChangeText={(text) =>
                              !submitted &&
                              setSelectedAnswer({ ...ans, [field.id]: text })
                            }
                            editable={!submitted}
                            multiline
                            numberOfLines={4}
                            placeholder={
                              field.placeholder || "Wpisz odpowiedź..."
                            }
                            placeholderTextColor={theme.textTertiary}
                            style={{
                              backgroundColor: theme.inputBg,
                              borderWidth: 1,
                              borderColor: submitted
                                ? hasAnswer
                                  ? colors.brand[500]
                                  : colors.red[500]
                                : theme.border,
                              borderRadius: 14,
                              padding: 14,
                              fontSize: 14,
                              fontFamily: "DMSans_400Regular",
                              color: theme.text,
                              textAlignVertical: "top",
                              minHeight: 100,
                            }}
                          />
                          {submitted && field.sampleAnswer && (
                            <View
                              style={{
                                marginTop: 8,
                                backgroundColor: colors.brand[500] + "10",
                                borderRadius: 12,
                                padding: 12,
                                borderLeftWidth: 3,
                                borderLeftColor: colors.brand[500],
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "700",
                                  color: colors.brand[600],
                                  marginBottom: 4,
                                }}
                              >
                                Przykładowa odpowiedź:
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: theme.text,
                                  lineHeight: 20,
                                }}
                              >
                                {field.sampleAnswer}
                              </Text>
                            </View>
                          )}
                          {submitted &&
                            result?.aiGrading?.fields?.[field.id] && (
                              <View
                                style={{
                                  marginTop: 8,
                                  padding: 12,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor:
                                    result.aiGrading.fields[field.id].score >=
                                    0.5
                                      ? colors.brand[500]
                                      : colors.red[500],
                                  backgroundColor:
                                    result.aiGrading.fields[field.id].score >=
                                    0.5
                                      ? colors.brand[500] + "10"
                                      : colors.red[500] + "10",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color:
                                      result.aiGrading.fields[field.id].score >=
                                      0.5
                                        ? colors.brand[600]
                                        : colors.red[600],
                                    marginBottom: 4,
                                  }}
                                >
                                  {result.aiGrading.fields[field.id].score >=
                                  0.5
                                    ? "✅"
                                    : "❌"}{" "}
                                  {result.aiGrading.fields[field.id]
                                    .pointsEarned ?? 0}
                                  /{field.points || 1} pkt
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: theme.textSecondary,
                                    lineHeight: 18,
                                  }}
                                >
                                  {result.aiGrading.fields[field.id].feedback}
                                </Text>
                              </View>
                            )}
                          {submitted && field.rubric && (
                            <Text
                              style={{
                                fontSize: 11,
                                color: theme.textTertiary,
                                fontStyle: "italic",
                                marginTop: 4,
                              }}
                            >
                              Kryteria: {field.rubric}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

            {/* LISTENING */}
            {question.type === "LISTENING" && (
              <ListeningQuestion
                content={content}
                response={
                  typeof selectedAnswer === "object" &&
                  selectedAnswer &&
                  !Array.isArray(selectedAnswer)
                    ? selectedAnswer
                    : null
                }
                onChange={(v) => setSelectedAnswer(v)}
                disabled={submitted}
                feedback={submitted ? result : null}
              />
            )}

            {/* Fallback */}
            {![
              "CLOSED",
              "TRUE_FALSE",
              "OPEN",
              "ESSAY",
              "MULTI_SELECT",
              "MATCHING",
              "CLOZE",
              "FILL_IN",
              "GRAPH_INTERPRET",
              "TABLE_DATA",
              "ERROR_FIND",
              "ORDERING",
              "PROOF_ORDER",
              "WIAZKA",
              "LISTENING",
              "EXPERIMENT_DESIGN",
              "CALCULATION",
            ].includes(question.type) &&
              content.options && (
                <View style={{ gap: 10 }}>
                  {content.options.map((opt: any) => (
                    <OptionCard
                      key={opt.id}
                      id={opt.id}
                      text={parseChemText(opt.text)}
                      state={getOptionState(opt.id) as any}
                      onPress={() =>
                        !submitted &&
                        setSelectedAnswer(
                          selectedAnswer === opt.id ? null : opt.id,
                        )
                      }
                      disabled={submitted}
                    />
                  ))}
                </View>
              )}
          </>
        )}
      </ScrollView>

      {/* ── Bottom action bar ──────────────────────────────────────────── */}
      {!loadingMore && question && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: spacing[5],
            paddingTop: 2,
            paddingBottom: 2,
            backgroundColor: theme.card,
            borderTopWidth: 1,
            borderTopColor: theme.borderLight,
          }}
        >
          {!submitted ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* Poprzednie + Pomiń (ikony) + Pokaż odpowiedź — kolumna */}
              <View
                style={{
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                }}
              >
                <View
                  style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
                >
                  {currentIndex > 0 && (
                    <TouchableOpacity
                      onPress={handlePrevious}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.inputBg,
                      }}
                    >
                      <Ionicons
                        name="play-back"
                        size={16}
                        color={theme.textTertiary}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleSkip}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.inputBg,
                    }}
                  >
                    <Ionicons
                      name="play-forward"
                      size={16}
                      color={theme.textTertiary}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    const correct = getCorrectAnswerLocal(
                      question.type,
                      content,
                    );
                    const revealData = {
                      isCorrect: false,
                      score: 0,
                      xpEarned: 0,
                      explanation:
                        question.content?.explanation || content?.explanation,
                      correctAnswer: correct,
                      revealed: true,
                    };
                    setResult(revealData);
                    setSubmitted(true);
                    setResultsMap((prev) => ({
                      ...prev,
                      [question.id]: revealData,
                    }));
                  }}
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: theme.textSecondary,
                    }}
                  >
                    Pokaż odpowiedź
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Button
                  title={loading ? "Sprawdzam..." : "Sprawdź odpowiedź"}
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={getResponse() === null}
                />
                {loading &&
                  [
                    "OPEN",
                    "ESSAY",
                    "EXPERIMENT_DESIGN",
                    "WIAZKA",
                    "CLOZE",
                    "FILL_IN",
                    "TABLE_DATA",
                    "GRAPH_INTERPRET",
                    "DIAGRAM_LABEL",
                    "CROSS_PUNNETT",
                    "CALCULATION",
                    "LISTENING",
                  ].includes(question.type) && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textTertiary,
                        marginTop: 6,
                        textAlign: "center",
                      }}
                    >
                      🤖 AI ocenia Twoją odpowiedź — zwykle 10-20 sekund...
                    </Text>
                  )}
              </View>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
            >
              {currentIndex > 0 && (
                <TouchableOpacity
                  onPress={handlePrevious}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                  }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={theme.textTertiary}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.textTertiary,
                      fontWeight: "500",
                    }}
                  >
                    Wróć
                  </Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }}>
                <Button
                  title="Następne pytanie →"
                  onPress={handleNext}
                  size="lg"
                  icon={
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  }
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
  function getCorrectAnswerLocal(type: string, content: any): any {
    switch (type) {
      case "CLOSED":
        return content.correctAnswer;
      case "MULTI_SELECT":
        return content.correctAnswers;
      case "TRUE_FALSE":
        return content.statements?.map((s: any) => s.isTrue);
      case "FILL_IN":
        return content.blanks?.map
          ? content.blanks.map((b: any) => b.acceptedAnswers?.[0])
          : Object.values(content.blanks).map(
              (b: any) => (b as any).acceptedAnswers?.[0],
            );
      case "MATCHING":
        return content.pairs;
      case "ORDERING":
        return content.correctOrder;
      case "ERROR_FIND":
        return content.correctErrorStep;
      case "CLOZE":
        return Object.fromEntries(
          Object.entries(content.blanks || {}).map(([k, b]: [string, any]) => [
            k,
            b.acceptedAnswers?.[0],
          ]),
        );
      case "PROOF_ORDER":
        return content.correctOrder;
      case "GRAPH_INTERPRET":
      case "TABLE_DATA":
        return content.subQuestions?.map((sq: any) => sq.acceptedAnswers?.[0]);
      case "WIAZKA":
        return content.subQuestions?.map((sq: any) => ({
          id: sq.id,
          type: sq.type,
          correctAnswer: sq.correctAnswer || sq.acceptedAnswers?.[0],
        }));
      default:
        return null;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// LIVE FILTER BAR (mobile version of web LiveFilterBar)
// ══════════════════════════════════════════════════════════════════════════

function LiveFilterBar({
  filters,
  onFiltersChange,
  onClear,
  open,
  setOpen,
  filterOptions,
  poolTotal,
  loading,
  theme,
}: {
  filters: LiveFilters;
  onFiltersChange: (f: LiveFilters) => void;
  onClear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  filterOptions: FilterOptions | null;
  poolTotal: number | undefined;
  loading: boolean;
  theme: any;
}) {
  if (!filterOptions) return null;

  const hasActive =
    filters.topicIds.length > 0 ||
    filters.types.length > 0 ||
    filters.difficulties.length > 0 ||
    filters.sources.length > 0;
  const activeCount = [
    filters.topicIds.length > 0,
    filters.types.length > 0,
    filters.difficulties.length > 0,
    filters.sources.length > 0,
  ].filter(Boolean).length;
  const tog = (a: string[], v: string) =>
    a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
  const togN = (a: number[], v: number) =>
    a.includes(v) ? a.filter((x) => x !== v) : [...a, v].sort();

  return (
    <View style={{ marginBottom: 12 }}>
      {/* Toggle button row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => setOpen(!open)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: hasActive ? colors.brand[500] : theme.card,
            borderWidth: hasActive ? 0 : 1,
            borderColor: theme.border,
          }}
        >
          <Ionicons
            name="funnel-outline"
            size={14}
            color={hasActive ? "#fff" : theme.textSecondary}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: hasActive ? "#fff" : theme.textSecondary,
            }}
          >
            Filtruj
          </Text>
          {activeCount > 0 && (
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.3)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
                {activeCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {hasActive && !open && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            <View style={{ flexDirection: "row", gap: 4 }}>
              {filters.types.length > 0 && (
                <MiniChip
                  label={filters.types
                    .map((t) => TYPE_LABELS[t] || t)
                    .join(", ")}
                  onClear={() => onFiltersChange({ ...filters, types: [] })}
                  theme={theme}
                />
              )}
              {filters.difficulties.length > 0 && (
                <MiniChip
                  label={`Poz. ${filters.difficulties.join(",")}`}
                  onClear={() =>
                    onFiltersChange({ ...filters, difficulties: [] })
                  }
                  theme={theme}
                />
              )}
              {filters.topicIds.length > 0 && (
                <MiniChip
                  label={`${filters.topicIds.length} tem.`}
                  onClear={() => onFiltersChange({ ...filters, topicIds: [] })}
                  theme={theme}
                />
              )}
              {filters.sources.length > 0 && (
                <MiniChip
                  label={filters.sources.join("+")}
                  onClear={() => onFiltersChange({ ...filters, sources: [] })}
                  theme={theme}
                />
              )}
            </View>
          </ScrollView>
        )}

        {hasActive && (
          <TouchableOpacity onPress={onClear}>
            <Text style={{ fontSize: 10, color: theme.textTertiary }}>
              ✕ Wyczyść
            </Text>
          </TouchableOpacity>
        )}
        {loading && (
          <ActivityIndicator size="small" color={colors.brand[500]} />
        )}
        {poolTotal !== undefined && hasActive && !loading && (
          <Text style={{ fontSize: 10, color: theme.textTertiary }}>
            {poolTotal} w puli
          </Text>
        )}
      </View>

      {/* Expanded filter panel */}
      {open && (
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 14,
          }}
        >
          {/* Topics */}
          {filterOptions.topics.length > 1 && (
            <FilterSection label="Temat" theme={theme}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {filterOptions.topics.map((t) => (
                    <Pill
                      key={t.id}
                      active={filters.topicIds.includes(t.id)}
                      onPress={() =>
                        onFiltersChange({
                          ...filters,
                          topicIds: tog(filters.topicIds, t.id),
                        })
                      }
                      theme={theme}
                    >
                      {t.name.replace(/^[IVXLCDM]+\.\s*/, "")} (
                      {t.questionCount})
                    </Pill>
                  ))}
                </View>
              </ScrollView>
            </FilterSection>
          )}

          {/* Types */}
          {filterOptions.types.length > 1 && (
            <FilterSection label="Typ" theme={theme}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {filterOptions.types.map((t) => (
                  <Pill
                    key={t.type}
                    active={filters.types.includes(t.type)}
                    onPress={() =>
                      onFiltersChange({
                        ...filters,
                        types: tog(filters.types, t.type),
                      })
                    }
                    theme={theme}
                  >
                    {TYPE_LABELS[t.type] || t.type} ({t.count})
                  </Pill>
                ))}
              </View>
            </FilterSection>
          )}

          {/* Difficulty */}
          {filterOptions.difficulties.length > 1 && (
            <FilterSection label="Trudność" theme={theme}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((d) => {
                  const opt = filterOptions.difficulties.find(
                    (x) => x.difficulty === d,
                  );
                  const diffColors = [
                    "",
                    "#22c55e",
                    "#0ea5e9",
                    "#f59e0b",
                    "#f97316",
                    "#ef4444",
                  ];
                  const isActive = filters.difficulties.includes(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() =>
                        opt &&
                        onFiltersChange({
                          ...filters,
                          difficulties: togN(filters.difficulties, d),
                        })
                      }
                      disabled={!opt}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: !opt
                          ? theme.inputBg
                          : isActive
                            ? diffColors[d]
                            : theme.card,
                        borderWidth: isActive ? 0 : 1,
                        borderColor: theme.border,
                        opacity: opt ? 1 : 0.3,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: isActive ? "#fff" : theme.textSecondary,
                        }}
                      >
                        {d}
                      </Text>
                      {opt && (
                        <Text
                          style={{
                            fontSize: 8,
                            color: isActive
                              ? "rgba(255,255,255,0.7)"
                              : theme.textTertiary,
                          }}
                        >
                          {opt.count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FilterSection>
          )}

          {/* Sources */}
          {filterOptions.sources.length > 1 && (
            <FilterSection label="Źródło" theme={theme}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {filterOptions.sources.map((s) => (
                  <Pill
                    key={s.source}
                    active={filters.sources.includes(s.source)}
                    onPress={() =>
                      onFiltersChange({
                        ...filters,
                        sources: tog(filters.sources, s.source),
                      })
                    }
                    theme={theme}
                  >
                    {s.source} ({s.count})
                  </Pill>
                ))}
              </View>
            </FilterSection>
          )}
        </View>
      )}
    </View>
  );
}

// ── Helper components ─────────────────────────────────────────────────────

function FilterSection({
  label,
  children,
  theme,
}: {
  label: string;
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: theme.textTertiary,
          letterSpacing: 1,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Pill({
  active,
  onPress,
  children,
  theme,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: active ? colors.brand[500] : theme.inputBg,
        borderWidth: active ? 0 : 1,
        borderColor: theme.border,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: active ? "#fff" : theme.textSecondary,
        }}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}

function MiniChip({
  label,
  onClear,
  theme,
}: {
  label: string;
  onClear: () => void;
  theme: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingLeft: 8,
        paddingRight: 4,
        paddingVertical: 3,
        borderRadius: 99,
        backgroundColor: colors.brand[500] + "1A",
      }}
    >
      <Text
        style={{ fontSize: 10, fontWeight: "500", color: colors.brand[600] }}
      >
        {label}
      </Text>
      <TouchableOpacity
        onPress={onClear}
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 8, color: colors.brand[600] }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function FormattedAnswer({
  answer,
  questionType,
  content,
  theme,
}: {
  answer: any;
  questionType: string;
  content: any;
  theme: any;
}) {
  const label = (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: colors.brand[600],
        marginBottom: 4,
      }}
    >
      Poprawna odpowiedź:
    </Text>
  );

  // Simple string
  if (typeof answer === "string") {
    // For CLOSED — resolve option text
    if (questionType === "CLOSED" && content?.options) {
      const opt = content.options.find((o: any) => o.id === answer);
      return (
        <View>
          {label}
          <Text style={{ fontSize: 14, color: theme.text, lineHeight: 21 }}>
            {opt ? `${opt.id}. ${opt.text}` : answer}
          </Text>
        </View>
      );
    }
    return (
      <View>
        {label}
        <Text style={{ fontSize: 14, color: theme.text, lineHeight: 21 }}>
          {answer}
        </Text>
      </View>
    );
  }

  // EXPERIMENT_DESIGN — show sample answers
  if (questionType === "EXPERIMENT_DESIGN" && content?.fields) {
    return (
      <View>
        {label}
        {content.fields.map((f: any) => (
          <View key={f.id} style={{ marginBottom: 6 }}>
            <Text
              style={{ fontSize: 13, fontWeight: "600", color: theme.text }}
            >
              {f.label}:
            </Text>
            <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
              {f.sampleAnswer || "—"}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // Array of strings (MULTI_SELECT option ids, ORDERING, TRUE_FALSE booleans)
  if (Array.isArray(answer)) {
    // TRUE_FALSE — array of booleans
    if (questionType === "TRUE_FALSE" && content?.statements) {
      return (
        <View>
          {label}
          {content.statements.map((s: any, i: number) => (
            <Text
              key={i}
              style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
            >
              • {s.text} → {answer[i] ? "Prawda" : "Fałsz"}
            </Text>
          ))}
        </View>
      );
    }
    // MULTI_SELECT — resolve option texts
    if (questionType === "MULTI_SELECT" && content?.options) {
      return (
        <View>
          {label}
          {answer.map((id: string) => {
            const opt = content.options.find((o: any) => o.id === id);
            return (
              <Text
                key={id}
                style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
              >
                • {opt ? `${opt.id}. ${opt.text}` : id}
              </Text>
            );
          })}
        </View>
      );
    }
    // ORDERING — list items
    if (questionType === "ORDERING" && content?.items) {
      return (
        <View>
          {label}
          {answer.map((idx: number, i: number) => (
            <Text
              key={i}
              style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
            >
              {i + 1}. {content.items[idx] || idx}
            </Text>
          ))}
        </View>
      );
    }
    // GRAPH/TABLE subQuestions answers
    if (
      (questionType === "GRAPH_INTERPRET" || questionType === "TABLE_DATA") &&
      content?.subQuestions
    ) {
      return (
        <View>
          {label}
          {content.subQuestions.map((sq: any, i: number) => (
            <Text
              key={sq.id}
              style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
            >
              • {sq.text}: {answer[i] || "—"}
            </Text>
          ))}
        </View>
      );
    }
    // MATCHING — array of {left, right}
    if (questionType === "MATCHING") {
      return (
        <View>
          {label}
          {answer.map((p: any, i: number) => (
            <Text
              key={i}
              style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
            >
              • {p.left} → {p.right}
            </Text>
          ))}
        </View>
      );
    }
    // Generic array
    return (
      <View>
        {label}
        {answer.map((item: any, i: number) => (
          <Text
            key={i}
            style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
          >
            {i + 1}. {typeof item === "string" ? item : JSON.stringify(item)}
          </Text>
        ))}
      </View>
    );
  }

  // Object — MATCHING pairs, CLOZE, FILL_IN, WIAZKA
  if (typeof answer === "object" && answer !== null) {
    // MATCHING — array of {left, right}
    if (questionType === "MATCHING" && Array.isArray(answer)) {
      return (
        <View>
          {label}
          {answer.map((p: any, i: number) => (
            <Text
              key={i}
              style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
            >
              • {p.left} → {p.right}
            </Text>
          ))}
        </View>
      );
    }
    // WIAZKA — array of {id, type, correctAnswer}
    if (questionType === "WIAZKA" && Array.isArray(answer)) {
      return (
        <View>
          {label}
          {answer.map((sq: any, i: number) => {
            const sub = content?.subQuestions?.[i];
            const val =
              typeof sq.correctAnswer === "boolean"
                ? sq.correctAnswer
                  ? "Prawda"
                  : "Fałsz"
                : Array.isArray(sq.correctAnswer)
                  ? sq.correctAnswer
                      .map((v: boolean) => (v ? "P" : "F"))
                      .join(", ")
                  : sq.correctAnswer;
            return (
              <Text
                key={sq.id}
                style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
              >
                {String.fromCharCode(97 + i)}) {sub?.text || sq.id}: {val}
              </Text>
            );
          })}
        </View>
      );
    }
    // CLOZE / FILL_IN — key-value
    if (questionType === "CLOZE" || questionType === "FILL_IN") {
      return (
        <View>
          {label}
          {Object.entries(answer).map(([k, v]: [string, any]) => (
            <Text
              key={k}
              style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
            >
              • {k}: {v}
            </Text>
          ))}
        </View>
      );
    }
    // Generic object
    return (
      <View>
        {label}
        {Object.entries(answer).map(([k, v]: [string, any]) => (
          <Text
            key={k}
            style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
          >
            • {k}: {typeof v === "string" ? v : JSON.stringify(v)}
          </Text>
        ))}
      </View>
    );
  }

  // Fallback
  return (
    <Text style={{ fontSize: 13, color: colors.brand[600] }}>
      {String(answer)}
    </Text>
  );
}

function SvgViewer({ svg, theme }: { svg: string; theme: any }) {
  const [zoomed, setZoomed] = React.useState(false);
  const baseH = 260;
  const h = zoomed ? baseH * 2 : baseH;
  const bg =
    theme.background === "#0a0a1a" || theme.background === "#0f0f23"
      ? "#0f0f23"
      : "#ffffff";

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:${bg};overflow:hidden}svg{width:100%;height:auto;max-height:100vh}</style></head><body>${svg}</body></html>`;

  const webview = (
    <WebView
      originWhitelist={["*"]}
      scrollEnabled={false}
      style={{
        backgroundColor: "transparent",
        height: h,
        width: zoomed ? SCREEN_WIDTH * 2 : undefined,
      }}
      source={{ html }}
    />
  );

  return (
    <View
      style={{
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: bg,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => setZoomed(!zoomed)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            backgroundColor: zoomed ? "rgba(99,102,241,0.2)" : theme.inputBg,
          }}
        >
          <Text style={{ fontSize: 12 }}>{zoomed ? "🔍" : "🔎"}</Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              color: zoomed ? "#6366f1" : theme.textTertiary,
            }}
          >
            {zoomed ? "Zmniejsz" : "Powiększ"}
          </Text>
        </TouchableOpacity>
      </View>

      {zoomed ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width: SCREEN_WIDTH * 2, height: h }}>{webview}</View>
        </ScrollView>
      ) : (
        <View style={{ height: baseH }}>{webview}</View>
      )}
    </View>
  );
}

function AiBadge({ label, isDark }: { label: string; isDark?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 99,
        backgroundColor: isDark ? "#5b21b620" : "#f3e8ff",
        borderWidth: 1,
        borderColor: isDark ? "#5b21b640" : "#e9d5ff",
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: "700",
          color: isDark ? "#c4b5fd" : "#7c3aed",
        }}
      >
        🤖 Ocena AI {label}
      </Text>
    </View>
  );
}
