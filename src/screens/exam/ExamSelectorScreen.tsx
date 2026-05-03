// src/screens/exam/ExamSelectorScreen.tsx

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { api } from "../../api/client";
import {
  getActiveExam,
  getAvailableExams,
  type ActiveExamData,
  type ExamInfo,
  type SubjectExamAvailability,
} from "../../api/exams";
import type { ExamStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ExamStackParamList>;

interface SubjectExamInfo {
  subjectId: string;
  subjectName: string;
  subjectIcon: string;
  subjectSlug: string;
  level: string;
  unseenCount: number;
  completedCount: number;
  timeMinutes: number;
  maxPoints: number;
}

export function ExamSelectorScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [activeExam, setActiveExam] = useState<ActiveExamData | null>(null);
  const [examInfos, setExamInfos] = useState<SubjectExamInfo[]>([]);
  const [selectedSubject, setSelectedSubject] =
    useState<SubjectExamInfo | null>(null);
  const [examList, setExamList] = useState<ExamInfo[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  // Check premium + active exam + subjects
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setActiveExam(null); // ← reset on every focus

      (async () => {
        try {
          const status = await api<{ isPremium: boolean }>("/stripe/status");
          if (cancelled) return;
          setIsPremium(status.isPremium);
          if (!status.isPremium) {
            setLoading(false);
            return;
          }

          // Active exam
          const active = await getActiveExam();
          if (cancelled) return;
          if (active.active) {
            setActiveExam(active);
            setLoading(false);
            return;
          }
          if (active.expired) {
            setActiveExam({ ...active, expired: true } as any);
          }

          // Load subjects
          const subs = await api<any[]>("/subjects");
          if (cancelled) return;
          const infos: SubjectExamInfo[] = [];
          for (const sub of subs) {
            try {
              const avail = await getAvailableExams(sub.id);
              if (avail.available) {
                infos.push({
                  subjectId: sub.id,
                  subjectName: sub.name,
                  subjectIcon: sub.icon || "📝",
                  subjectSlug: sub.slug,
                  level: "PODSTAWOWY",
                  unseenCount: avail.unseenCount,
                  completedCount: avail.completedCount,
                  timeMinutes: avail.timeMinutes,
                  maxPoints: avail.maxPoints,
                });
              }
            } catch {}
          }
          if (!cancelled) setExamInfos(infos);
        } catch (err: any) {
          console.error(err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleSubjectClick = async (info: SubjectExamInfo) => {
    setLoadingExams(true);
    try {
      const data = await getAvailableExams(info.subjectId, info.level);
      setExamList(data.exams || []);
      setSelectedSubject(info);
    } catch (err: any) {
      Alert.alert("Błąd", err.message);
    } finally {
      setLoadingExams(false);
    }
  };

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
      </View>
    );
  }

  // Premium gate
  if (isPremium === false) {
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
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: theme.text,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Egzamin Live — tylko Premium
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.textSecondary,
            textAlign: "center",
            lineHeight: 21,
            marginBottom: 24,
          }}
        >
          Pełne symulacje maturalne z timerem, oceną AI i feedbackiem CKE.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 100,
      }}
    >
      {/* Header */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.text,
          marginBottom: 4,
        }}
      >
        Egzamin Live 📝
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: theme.textSecondary,
          marginBottom: 24,
          lineHeight: 21,
        }}
      >
        Pełny symulator matury. Timer, arkusz, feedback AI.
      </Text>

      {/* Active exam */}
      {activeExam?.active && !activeExam.expired && (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ExamPlay", {
              examId: activeExam.examId!,
              subjectId: "",
            })
          }
          style={{
            padding: 20,
            borderRadius: 20,
            backgroundColor: "#fef3c7",
            borderWidth: 2,
            borderColor: "#fbbf24",
            marginBottom: 20,
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
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#ef4444",
              }}
            />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#dc2626" }}>
              EGZAMIN W TOKU
            </Text>
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#92400e",
              marginBottom: 4,
            }}
          >
            {activeExam.examTitle}
          </Text>
          <Text style={{ fontSize: 13, color: "#78350f" }}>
            ⏱ {activeExam.remainingMinutes} min • {activeExam.answeredCount}{" "}
            odpowiedzi
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: "#d97706",
              marginTop: 12,
            }}
          >
            Kontynuuj →
          </Text>
        </TouchableOpacity>
      )}

      {/* Expired exam */}
      {activeExam?.expired && (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ExamResults", {
              attemptId: activeExam.attemptId!,
            })
          }
          style={{
            padding: 20,
            borderRadius: 20,
            backgroundColor: "#f5f3ff",
            borderWidth: 1,
            borderColor: "#ddd6fe",
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 32, marginBottom: 8 }}>⏰</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#5b21b6" }}>
            Czas egzaminu minął
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: "#6d28d9",
              marginTop: 4,
              lineHeight: 20,
            }}
          >
            Zadania zamknięte oceniono automatycznie. Ocenę AI uruchomisz w
            wynikach.
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: "#7c3aed",
              marginTop: 12,
            }}
          >
            Zobacz wyniki →
          </Text>
        </TouchableOpacity>
      )}

      {/* Don't show rest if active exam */}
      {activeExam?.active && !activeExam.expired ? null : (
        <>
          {/* Subject selection */}
          {!selectedSubject && (
            <>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.text,
                  marginBottom: 12,
                }}
              >
                Wybierz przedmiot
              </Text>

              {examInfos.length === 0 && (
                <View
                  style={{
                    padding: 32,
                    alignItems: "center",
                    backgroundColor: theme.card,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🚧</Text>
                  <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                    Egzamin Live będzie dostępny wkrótce.
                  </Text>
                </View>
              )}

              {examInfos.map((info) => (
                <TouchableOpacity
                  key={`${info.subjectId}-${info.level}`}
                  onPress={() => handleSubjectClick(info)}
                  style={{
                    padding: 20,
                    borderRadius: 20,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{info.subjectIcon}</Text>
                    <View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: theme.text,
                        }}
                      >
                        {info.subjectName}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: theme.textSecondary }}
                      >
                        {info.timeMinutes} min • {info.maxPoints} pkt
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.brand[500],
                        fontWeight: "600",
                      }}
                    >
                      {info.unseenCount} nowych
                    </Text>
                    {info.completedCount > 0 && (
                      <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                        {info.completedCount} ukończonych
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Exam list */}
          {selectedSubject && (
            <>
              <TouchableOpacity
                onPress={() => {
                  setSelectedSubject(null);
                  setExamList([]);
                }}
                style={{ marginBottom: 16 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    fontWeight: "600",
                  }}
                >
                  ← Zmień przedmiot
                </Text>
              </TouchableOpacity>

              {loadingExams ? (
                <ActivityIndicator
                  size="small"
                  color={colors.brand[500]}
                  style={{ marginTop: 32 }}
                />
              ) : examList.length === 0 ? (
                <View
                  style={{
                    padding: 32,
                    alignItems: "center",
                    backgroundColor: theme.card,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>✨</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: theme.textSecondary,
                      textAlign: "center",
                    }}
                  >
                    AI generuje nowe arkusze. Odśwież za chwilę.
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: theme.text,
                      marginBottom: 12,
                    }}
                  >
                    Dostępne arkusze
                  </Text>
                  {examList.map((exam) => (
                    <TouchableOpacity
                      key={exam.id}
                      onPress={() =>
                        navigation.navigate("ExamPlay", {
                          examId: exam.id,
                          subjectId: selectedSubject.subjectId,
                        })
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: theme.card,
                        borderWidth: 1,
                        borderColor: theme.borderLight,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          backgroundColor: colors.navy[500] + "15",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "800",
                            color: colors.navy[500],
                          }}
                        >
                          #{exam.examNumber}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: theme.text,
                          }}
                        >
                          {exam.title}
                        </Text>
                        <Text
                          style={{ fontSize: 12, color: theme.textSecondary }}
                        >
                          {exam.timeMinutes} min • {exam.maxPoints} pkt
                        </Text>
                      </View>
                      <Ionicons
                        name="play-circle"
                        size={28}
                        color={colors.brand[500]}
                      />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}

          {/* History link */}
          <TouchableOpacity
            onPress={() => navigation.navigate("ExamHistory")}
            style={{ alignItems: "center", marginTop: 24 }}
          >
            <Text
              style={{
                fontSize: 13,
                color: theme.textTertiary,
              }}
            >
              📜 Historia egzaminów
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
