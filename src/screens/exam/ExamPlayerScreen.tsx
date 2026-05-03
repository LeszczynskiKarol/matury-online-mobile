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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { MathEditor } from "../../components/exam/MathEditor";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OptionCard } from "../../components/quiz/OptionCard";
import { parseChemText } from "../../utils/chemText";
import {
  startExam,
  saveExamAnswers,
  submitExam,
  type ExamStartData,
} from "../../api/exams";
import type { ExamStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ExamStackParamList>;

// ══════════════════════════════════════════════════════════════════════════

export function ExamPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const { examId } = route.params as { examId: string };

  const scrollRef = useRef<ScrollView>(null);

  // ── State ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"loading" | "exam" | "submitting">(
    "loading",
  );
  const [data, setData] = useState<ExamStartData | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentTaskId, setCurrentTaskId] = useState("");
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [timeUpModal, setTimeUpModal] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);

  const examStartedAtRef = useRef(0);
  const totalTimeMsRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load exam ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const examData = await startExam(examId);
        setData(examData);
        setAnswers(examData.savedAnswers || {});

        const allTasks = examData.exam.content.parts.flatMap(
          (p: any) => p.tasks,
        );
        setCurrentTaskId(examData.currentTaskId || allTasks[0]?.id || "");

        examStartedAtRef.current = new Date(examData.startedAt).getTime();
        sessionStartRef.current = Date.now();
        totalTimeMsRef.current = examData.exam.timeMinutes * 60 * 1000;
        setRemainingMs(
          Math.max(
            0,
            totalTimeMsRef.current - (Date.now() - examStartedAtRef.current),
          ),
        );
        setPhase("exam");
      } catch (err: any) {
        setError(err.message || "Nie udało się rozpocząć egzaminu.");
      }
    })();
  }, [examId]);

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
    if (remainingMs <= 0 && phase === "exam" && data) {
      setTimeUpModal(true);
    }
  }, [remainingMs, phase]);

  // ── Autosave ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam" || !data) return;
    autosaveRef.current = setInterval(() => {
      saveExamAnswers(data.attemptId, {
        answers,
        currentTaskId,
        timeSpentMs: Date.now() - sessionStartRef.current,
      }).catch(() => {});
    }, 30000);
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [phase, data, answers, currentTaskId]);

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
  const isWarning = remainingMs < 15 * 60000;
  const isCritical = remainingMs < 5 * 60000;

  const answeredCount = allTasks.filter((t: any) => {
    const a = answers[t.id];
    if (a === null || a === undefined) return false;
    if (typeof a === "string") return a.trim().length > 0;
    if (typeof a === "object") return Object.keys(a).length > 0;
    return true;
  }).length;

  // ── Helpers ────────────────────────────────────────────────────────
  const setAnswer = useCallback((taskId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [taskId]: value }));
  }, []);

  const goToTask = useCallback((id: string) => {
    setCurrentTaskId(id);
    setShowNav(false);
    setShowMaterials(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < allTasks.length - 1)
      goToTask(allTasks[currentIndex + 1].id);
  }, [currentIndex, allTasks, goToTask]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goToTask(allTasks[currentIndex - 1].id);
  }, [currentIndex, allTasks, goToTask]);

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (skipAi: boolean) => {
      if (!data) return;
      setPhase("submitting");
      setConfirmModal(false);
      setTimeUpModal(false);
      try {
        const res = await submitExam(data.attemptId, {
          answers,
          timeSpentMs: Date.now() - sessionStartRef.current,
          timeLeftMs: remainingMs,
          skipAiGrading: skipAi,
        });
        navigation.replace("ExamResults", { attemptId: data.attemptId });
      } catch (err: any) {
        Alert.alert("Błąd", err.message || "Nie udało się przesłać egzaminu.");
        setPhase("exam");
      }
    },
    [data, answers, remainingMs, navigation],
  );

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
          Przesyłanie egzaminu...
        </Text>
      </View>
    );
  }

  if (!data || !currentTask) return null;

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ═══ TIME UP MODAL ═══ */}
      <Modal visible={timeUpModal} transparent animationType="fade">
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
              maxWidth: 380,
            }}
          >
            <Text
              style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}
            >
              ⏰
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: theme.text,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Czas minął!
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Wybierz sposób oceny:
            </Text>
            <TouchableOpacity
              onPress={() => handleSubmit(false)}
              style={{
                backgroundColor: "#7c3aed",
                borderRadius: 16,
                paddingVertical: 16,
                marginBottom: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                🤖 Oceń z AI
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <View
                  style={{
                    backgroundColor: "#fff",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 99,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: "#7c3aed",
                    }}
                  >
                    💎 15 kredytów
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                  • ~3-5 min
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSubmit(true)}
              style={{
                backgroundColor: theme.inputBg,
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: theme.text }}
              >
                ⚡ Bez AI (0 kredytów)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ CONFIRM SUBMIT MODAL ═══ */}
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
              padding: 28,
              width: "100%",
              maxWidth: 380,
            }}
          >
            <Text
              style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}
            >
              📝
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
              Zakończyć egzamin?
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              Odpowiedziałeś na {answeredCount} z {allTasks.length} pytań.
            </Text>
            {answeredCount < allTasks.length && (
              <Text
                style={{
                  fontSize: 12,
                  color: "#f59e0b",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                ⚠ {allTasks.length - answeredCount} bez odpowiedzi → 0 pkt
              </Text>
            )}
            <TouchableOpacity
              onPress={() => handleSubmit(false)}
              style={{
                backgroundColor: colors.brand[500],
                borderRadius: 16,
                paddingVertical: 14,
                marginBottom: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                🤖 Zakończ i oceń z AI
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <View
                  style={{
                    backgroundColor: "#fff",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 99,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: colors.brand[700],
                    }}
                  >
                    💎 15 kredytów
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                  • ~3-5 min
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSubmit(true)}
              style={{
                backgroundColor: theme.inputBg,
                borderRadius: 16,
                paddingVertical: 12,
                marginBottom: 8,
                alignItems: "center",
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text
                style={{ fontSize: 13, fontWeight: "600", color: theme.text }}
              >
                ⚡ Bez AI (0 kredytów)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setConfirmModal(false)}
              style={{ paddingVertical: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 13, color: theme.textTertiary }}>
                ← Wróć do egzaminu
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

          {/* Progress text */}
          <View style={{ flex: 1, alignItems: "center" }}>
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
              {answeredCount} odpowiedzi
            </Text>
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
            onPress={() => setConfirmModal(true)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 14,
              backgroundColor: colors.brand[500],
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
              Zakończ
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
            const mat = currentPart.materials.find((m: any) => m.id === matId);
            if (!mat) return null;
            return (
              <View
                key={mat.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: isDark ? "#92400e10" : "#fffbeb",
                  borderWidth: 1,
                  borderColor: isDark ? "#92400e30" : "#fde68a",
                  marginBottom: 12,
                }}
              >
                {mat.author && (
                  <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                    {mat.author}
                  </Text>
                )}
                {mat.title && (
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      fontStyle: "italic",
                      color: theme.text,
                      marginBottom: 8,
                    }}
                  >
                    {mat.title}
                  </Text>
                )}
                <Text
                  style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}
                >
                  {mat.content}
                </Text>
                {mat.footnotes?.map((fn: string, i: number) => (
                  <Text
                    key={i}
                    style={{
                      fontSize: 10,
                      color: theme.textTertiary,
                      marginTop: 6,
                    }}
                  >
                    {i + 1}. {fn}
                  </Text>
                ))}
              </View>
            );
          })}

        {/* Task card */}
        <Card style={{ marginBottom: 20 }}>
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
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: theme.text,
              lineHeight: 24,
              marginBottom: 20,
            }}
          >
            {parseChemText(currentTask.instruction)}
          </Text>

          {/* ═══ TASK INPUT RENDERERS ═══ */}
          <ExamTaskInput
            task={currentTask}
            value={answers[currentTask.id]}
            onChange={(v: any) => setAnswer(currentTask.id, v)}
            theme={theme}
            isDark={isDark}
          />
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
            title="Zakończ ✓"
            onPress={() => setConfirmModal(true)}
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

function ExamTaskInput({
  task,
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
  const content = task.content || {};

  // ── Generic table/graph rendering (before task-specific input) ──
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
                  minWidth: 60,
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
                    minWidth: 60,
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

  // Wrap task-specific input with table/graph above it
  const taskInput = (() => {
    switch (task.type) {
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
        if (task.type === "math_multi_select") {
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
        // math_two_part — two textareas
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
          />
        );
    }
  })();

  // Render: graph/table first, then task input
  return (
    <View>
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
