// src/screens/exam/ExamResultsScreen.tsx

// ============================================================================
// ExamResultsScreen — Review mode with grading overlay
// ============================================================================

import React, { useState, useEffect } from "react";
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
import { getExamResults, gradeExamWithAI, resetExam } from "../../api/exams";
import type { ExamStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ExamStackParamList>;

function getScoreTier(pct: number, isDark: boolean) {
  if (pct >= 85)
    return {
      emoji: "🏆",
      label: "Doskonale!",
      color: isDark ? "#34d399" : "#059669",
      bg: isDark ? "#05966910" : "#ecfdf5",
      border: isDark ? "#05966940" : "#a7f3d0",
    };
  if (pct >= 65)
    return {
      emoji: "🎉",
      label: "Dobry wynik!",
      color: isDark ? "#60a5fa" : "#2563eb",
      bg: isDark ? "#2563eb10" : "#eff6ff",
      border: isDark ? "#2563eb40" : "#bfdbfe",
    };
  if (pct >= 50)
    return {
      emoji: "📝",
      label: "Zdany",
      color: isDark ? "#fbbf24" : "#d97706",
      bg: isDark ? "#d9770610" : "#fffbeb",
      border: isDark ? "#d9770640" : "#fde68a",
    };
  if (pct >= 30)
    return {
      emoji: "⚠️",
      label: "Na granicy",
      color: isDark ? "#fb923c" : "#ea580c",
      bg: isDark ? "#ea580c10" : "#fff7ed",
      border: isDark ? "#ea580c40" : "#fed7aa",
    };
  return {
    emoji: "💪",
    label: "Niezdany — nie poddawaj się!",
    color: isDark ? "#f87171" : "#dc2626",
    bg: isDark ? "#dc262610" : "#fef2f2",
    border: isDark ? "#dc262640" : "#fecaca",
  };
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
  const [showMaterials, setShowMaterials] = useState(false);

  // Fetch with polling
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    let off = false;

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
        setError(null);
        setData(r);
        setLoading(false);
        setCurrentTaskId("__summary__");
      } catch (e: any) {
        if (!off) {
          if (poll) clearInterval(poll);
          setError(e.message);
          setLoading(false);
        }
      }
    };
    go();
    return () => {
      off = true;
      if (poll) clearInterval(poll);
    };
  }, [attemptId]);

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
      "Zadania otwarte",
      "Notatka",
      "Wypracowanie",
      "Feedback",
      "Finalizacja",
    ];
    const cur = Math.floor(gradingProgress / 18);
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
          AI ocenia egzamin...
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
        <Text style={{ fontSize: 40, marginBottom: 16 }}>⏳</Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary }}>
          Wyniki niedostępne.
        </Text>
        <Button
          title="Wróć"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 20 }}
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

  const goToTask = (id: string) => {
    setCurrentTaskId(id);
    setShowNav(false);
    setShowMaterials(false);
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
              {examContent.parts.map((part: any) => (
                <View key={part.id} style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: theme.textTertiary,
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    {part.name.replace("Część ", "Cz. ")}
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {part.tasks.map((task: any) => {
                      const tg = gradingMap.get(task.id);
                      const isCur = task.id === currentTaskId;
                      const dotColor = (tg as any)?._ungraded
                        ? "#a855f7"
                        : tg?.isCorrect
                          ? colors.brand[500]
                          : (tg?.pointsEarned ?? 0) > 0
                            ? "#f59e0b"
                            : "#ef4444";
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
                              : theme.inputBg,
                            borderWidth: isCur ? 0 : 2,
                            borderColor: dotColor,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: isCur ? "#fff" : theme.text,
                            }}
                          >
                            {task.number}
                          </Text>
                          <Text
                            style={{
                              fontSize: 8,
                              fontWeight: "700",
                              color: isCur ? "rgba(255,255,255,0.7)" : dotColor,
                            }}
                          >
                            {(tg as any)?._ungraded
                              ? "?"
                              : (tg?.pointsEarned ?? 0)}
                            /{tg?.maxPoints ?? task.points}
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
                : `Zad. ${currentTask?.number} / ${allTasks.length}`}
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
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* ── SUMMARY ── */}
        {isSummary && (
          <View>
            {/* Score card */}
            <View
              style={{
                borderRadius: 20,
                padding: 24,
                marginBottom: 20,
                backgroundColor: tier.bg,
                borderWidth: 1,
                borderColor: tier.border,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>
                {tier.emoji}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: theme.text,
                  marginBottom: 4,
                }}
              >
                {exam.title}
              </Text>
              <Text
                style={{ fontSize: 28, fontWeight: "800", color: tier.color }}
              >
                {grading.totalScore}/{grading.maxScore} pkt (
                {grading.percentage}%)
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: tier.color,
                  marginTop: 4,
                }}
              >
                {feedback.predictedMatura}
              </Text>
            </View>

            {/* Motivational */}
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

            {/* Grade with AI button */}
            {feedback.isPartialGrading && (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await gradeExamWithAI(attemptId);
                    setLoading(true);
                    setError("GRADING");
                    setGradingProgress(0);
                  } catch (err: any) {
                    Alert.alert("Błąd", err.message);
                  }
                }}
                style={{
                  padding: 20,
                  borderRadius: 16,
                  marginBottom: 20,
                  alignItems: "center",
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: "#a855f7",
                  backgroundColor: isDark ? "#5b21b610" : "#faf5ff",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  ⚡ Zadania otwarte nie zostały ocenione.
                </Text>
                <View
                  style={{
                    backgroundColor: "#7c3aed",
                    borderRadius: 14,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                  >
                    🤖 Oceń z AI (pełna ocena CKE)
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: isDark ? "#5b21b630" : "#f3e8ff",
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
                  <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                    ~3-5 min
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Strengths + Weaknesses */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
              <Card style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: theme.text,
                    marginBottom: 8,
                  }}
                >
                  💪 Mocne strony
                </Text>
                {feedback.strengths?.map((s: string, i: number) => (
                  <View
                    key={i}
                    style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.brand[500],
                        fontWeight: "700",
                      }}
                    >
                      ✓
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textSecondary,
                        flex: 1,
                        lineHeight: 17,
                      }}
                    >
                      {s}
                    </Text>
                  </View>
                ))}
              </Card>
              <Card style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: theme.text,
                    marginBottom: 8,
                  }}
                >
                  ⚠️ Do poprawy
                </Text>
                {feedback.weaknesses?.map((w: string, i: number) => (
                  <View
                    key={i}
                    style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#ef4444",
                        fontWeight: "700",
                      }}
                    >
                      !
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textSecondary,
                        flex: 1,
                        lineHeight: 17,
                      }}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>

            {/* Recommendations */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: theme.text,
                marginBottom: 10,
              }}
            >
              🎯 Rekomendacje
            </Text>
            {feedback.recommendations?.map((rec: any, i: number) => (
              <Card
                key={i}
                style={{
                  marginBottom: 10,
                  borderLeftWidth: 4,
                  borderLeftColor:
                    rec.priority === "high"
                      ? "#ef4444"
                      : rec.priority === "medium"
                        ? "#f59e0b"
                        : "#d4d4d8",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 99,
                      backgroundColor:
                        rec.priority === "high"
                          ? "#fef2f2"
                          : rec.priority === "medium"
                            ? "#fffbeb"
                            : "#f4f4f5",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color:
                          rec.priority === "high"
                            ? "#dc2626"
                            : rec.priority === "medium"
                              ? "#d97706"
                              : "#71717a",
                      }}
                    >
                      {rec.priority === "high"
                        ? "🔴 Wysoki"
                        : rec.priority === "medium"
                          ? "🟡 Średni"
                          : "🟢 Niski"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: theme.text,
                    }}
                  >
                    {rec.area}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.textSecondary,
                    lineHeight: 17,
                  }}
                >
                  {rec.description}
                </Text>
              </Card>
            ))}

            {/* Retry button */}
            <TouchableOpacity
              onPress={() => setShowRetryModal(true)}
              style={{
                alignItems: "center",
                marginTop: 24,
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 16,
                backgroundColor: theme.inputBg,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: theme.textSecondary,
                }}
              >
                🔄 Rozwiąż ponownie od zera
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: theme.textTertiary,
                  marginTop: 4,
                }}
              >
                Obecne wyniki zostaną zastąpione.
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TASK REVIEW ── */}
        {!isSummary && currentTask && currentGrading && (
          <View>
            {currentPart && (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: theme.text,
                  marginBottom: 12,
                }}
              >
                {currentPart.name}
              </Text>
            )}

            {/* Materials */}
            {currentTask.materialIds?.length > 0 && currentPart && (
              <TouchableOpacity
                onPress={() => setShowMaterials(!showMaterials)}
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 14,
                  backgroundColor: isDark ? "#92400e20" : "#fffbeb",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isDark ? "#fbbf24" : "#92400e",
                  }}
                >
                  📄 {showMaterials ? "Ukryj teksty" : "Pokaż teksty"}
                </Text>
              </TouchableOpacity>
            )}
            {showMaterials &&
              currentPart &&
              (currentTask.materialIds || []).map((matId: string) => {
                const mat = currentPart.materials.find(
                  (m: any) => m.id === matId,
                );
                if (!mat) return null;
                return (
                  <View
                    key={mat.id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      backgroundColor: isDark ? "#92400e10" : "#fffbeb",
                      borderWidth: 1,
                      borderColor: isDark ? "#92400e30" : "#fde68a",
                      marginBottom: 10,
                    }}
                  >
                    {mat.title && (
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          fontStyle: "italic",
                          color: theme.text,
                          marginBottom: 6,
                        }}
                      >
                        {mat.title}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.text,
                        lineHeight: 19,
                      }}
                    >
                      {mat.content}
                    </Text>
                  </View>
                );
              })}

            {/* Task card with grading */}
            <Card
              style={{
                borderWidth: 2,
                borderColor: currentGrading.isCorrect
                  ? colors.brand[500]
                  : currentGrading.pointsEarned > 0
                    ? "#f59e0b"
                    : "#ef4444",
              }}
            >
              {/* Header */}
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
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: currentGrading.isCorrect
                      ? colors.brand[500]
                      : currentGrading.pointsEarned > 0
                        ? "#f59e0b"
                        : "#ef4444",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}
                  >
                    {currentTask.number}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 11, color: theme.textTertiary, flex: 1 }}
                >
                  {currentTask.points} pkt
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: currentGrading.isCorrect
                      ? colors.brand[600]
                      : currentGrading.pointsEarned > 0
                        ? "#d97706"
                        : "#dc2626",
                  }}
                >
                  {currentGrading.pointsEarned}/{currentGrading.maxPoints}
                </Text>
                <Text style={{ fontSize: 18 }}>
                  {currentGrading.isCorrect
                    ? "✅"
                    : currentGrading.pointsEarned > 0
                      ? "⚠️"
                      : "❌"}
                </Text>
              </View>

              {/* Instruction */}
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: theme.text,
                  lineHeight: 23,
                  marginBottom: 16,
                }}
              >
                {parseChemText(currentTask.instruction)}
              </Text>

              {/* User answer */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: theme.textTertiary,
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  TWOJA ODPOWIEDŹ
                </Text>
                <View
                  style={{
                    backgroundColor: theme.inputBg,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text
                    style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}
                  >
                    {formatUserResponse(currentGrading.userResponse)}
                  </Text>
                </View>
              </View>

              {/* Analysis */}
              {(currentGrading.analysis.correct.length > 0 ||
                currentGrading.analysis.incorrect.length > 0 ||
                currentGrading.analysis.missing.length > 0) && (
                <View
                  style={{
                    backgroundColor: theme.inputBg,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  {currentGrading.analysis.correct.map(
                    (c: string, i: number) => (
                      <View
                        key={`c${i}`}
                        style={{
                          flexDirection: "row",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.brand[500],
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          ✓
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.textSecondary,
                            flex: 1,
                            lineHeight: 18,
                          }}
                        >
                          {c}
                        </Text>
                      </View>
                    ),
                  )}
                  {currentGrading.analysis.incorrect.map(
                    (c: string, i: number) => (
                      <View
                        key={`i${i}`}
                        style={{
                          flexDirection: "row",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: "#ef4444",
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          ✗
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.textSecondary,
                            flex: 1,
                            lineHeight: 18,
                          }}
                        >
                          {c}
                        </Text>
                      </View>
                    ),
                  )}
                  {currentGrading.analysis.missing.map(
                    (c: string, i: number) => (
                      <View
                        key={`m${i}`}
                        style={{
                          flexDirection: "row",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: "#f59e0b",
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          !
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.textSecondary,
                            flex: 1,
                            lineHeight: 18,
                          }}
                        >
                          {c}
                        </Text>
                      </View>
                    ),
                  )}
                  {currentGrading.analysis.suggestion && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#0ea5e9",
                        marginTop: 8,
                        lineHeight: 18,
                      }}
                    >
                      💡 {currentGrading.analysis.suggestion}
                    </Text>
                  )}
                </View>
              )}

              {/* Ungraded notice */}
              {(currentGrading as any)?._ungraded && (
                <View
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? "#5b21b610" : "#faf5ff",
                    borderWidth: 1,
                    borderColor: "#a855f7",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: "#7c3aed",
                    }}
                  >
                    🤖 Wymaga oceny AI
                  </Text>
                </View>
              )}

              {/* CKE Criteria */}
              {currentGrading.criteria?.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: theme.textTertiary,
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    KRYTERIA CKE
                  </Text>
                  {currentGrading.criteria.map((cr: any, i: number) => (
                    <View
                      key={i}
                      style={{
                        backgroundColor: theme.inputBg,
                        borderRadius: 10,
                        padding: 10,
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: theme.text,
                          }}
                        >
                          {cr.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color:
                              cr.score >= cr.maxScore * 0.7
                                ? colors.brand[600]
                                : cr.score > 0
                                  ? "#d97706"
                                  : "#dc2626",
                          }}
                        >
                          {cr.score}/{cr.maxScore}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          color: theme.textTertiary,
                          lineHeight: 15,
                        }}
                      >
                        {cr.feedback}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Model answer */}
              {currentGrading.modelAnswer && (
                <View
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: isDark ? "#047857" + "10" : "#ecfdf5",
                    borderWidth: 1,
                    borderColor: isDark ? "#04785730" : "#a7f3d0",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: "#059669",
                      letterSpacing: 1,
                      marginBottom: 4,
                    }}
                  >
                    📝 WZORCOWA ODPOWIEDŹ
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: theme.text, lineHeight: 19 }}
                  >
                    {parseChemText(currentGrading.modelAnswer)}
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}
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
        <TouchableOpacity onPress={goPrev} style={{ padding: 10 }}>
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
          {isSummary
            ? "Podsumowanie"
            : `${currentIndex + 1} / ${allTasks.length}`}
        </Text>
        <Button
          title={
            isSummary
              ? "Zadanie 1 →"
              : currentIndex === allTasks.length - 1
                ? "Podsumowanie"
                : "Następne →"
          }
          onPress={goNext}
          size="sm"
        />
      </View>
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
