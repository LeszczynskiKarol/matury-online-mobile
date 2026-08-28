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
import { PremiumGate } from "../../components/common/PremiumGate";
import { AdminExamList } from "../../components/exam/AdminExamList";
import { colors } from "../../theme/colors";
import { api } from "../../api/client";
import {
  getActiveExam,
  getAvailableExams,
  type ActiveExamData,
  type ExamInfo,
  type SubjectExamAvailability,
} from "../../api/exams";
import { getTrialStatus, type TrialStatus } from "../../api/premium";
import { radius } from "../../theme";
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
  const [trial, setTrial] = useState<TrialStatus | null>(null);

  // Check premium + active exam + subjects
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setActiveExam(null); // ← reset on every focus

      (async () => {
        try {
          const [status, trialStatus] = await Promise.all([
            api<{ isPremium: boolean }>("/stripe/status"),
            getTrialStatus().catch(() => null),
          ]);
          if (cancelled) return;
          setIsPremium(status.isPremium);
          setTrial(trialStatus);

          // Oferta próbna daje dostęp do katalogu i JEDNEGO arkusza. Gdy
          // arkusz jest już przypięty (examId), katalog w ogóle się nie
          // renderuje — więc nie ma po co go pobierać.
          const trialAccess =
            !!trialStatus && (trialStatus.active || !!trialStatus.examId);
          if (!status.isPremium && (!trialAccess || trialStatus!.examId)) {
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

          // Subjects + order równolegle
          const [subs, orderRes] = await Promise.all([
            api<any[]>("/subjects"),
            api<{ order: string[] }>("/exams/subjects-order").catch(() => ({
              order: [] as string[],
            })),
          ]);
          if (cancelled) return;

          // Wszystkie kombinacje przedmiot × poziom równolegle
          const checks = subs.flatMap((sub: any) =>
            (["PODSTAWOWY", "ROZSZERZONY"] as const).map((level) =>
              getAvailableExams(sub.id, level)
                .then((avail) =>
                  avail.available
                    ? ({
                        subjectId: sub.id,
                        subjectName: sub.name,
                        subjectIcon: sub.icon || "📝",
                        subjectSlug: sub.slug,
                        level,
                        unseenCount: avail.unseenCount,
                        completedCount: avail.completedCount,
                        timeMinutes: avail.timeMinutes,
                        maxPoints: avail.maxPoints,
                      } as SubjectExamInfo)
                    : null,
                )
                .catch(() => null),
            ),
          );

          const results = await Promise.all(checks);
          if (cancelled) return;

          const order = orderRes.order || [];
          const sorted = (results.filter(Boolean) as SubjectExamInfo[]).sort(
            (a, b) => {
              const iA = order.indexOf(a.subjectSlug);
              const iB = order.indexOf(b.subjectSlug);
              const subA = iA === -1 ? 99 : iA;
              const subB = iB === -1 ? 99 : iB;
              if (subA !== subB) return subA - subB;
              return a.level === "PODSTAWOWY" ? -1 : 1;
            },
          );
          setExamInfos(sorted);
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
      // Weź pierwszy niewidziany, fallback na pierwszy z listy (jak desktop)
      const exam =
        (data.exams || []).find((e: any) => !(e as any).completed) ||
        data.exams?.[0];

      if (exam) {
        navigation.navigate("ExamPlay", {
          examId: exam.id,
          subjectId: info.subjectId,
        });
        return;
      }

      // Brak arkuszy — pokaż komunikat "AI generuje"
      setSelectedSubject(info);
      setExamList([]);
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

  // Arkusz z oferty próbnej już przypięty — pokazujemy WYŁĄCZNIE jego.
  // Katalog pozostałych arkuszy byłby listą rzeczy, których nie da się
  // otworzyć (backend odbija je 403), a user i tak nie wiedziałby, który
  // wybrał.
  if (isPremium === false && trial?.examId) {
    const done =
      trial.attemptStatus === "COMPLETED" || trial.attemptStatus === "GRADING";
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 100,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text }}>
          Twój darmowy arkusz
        </Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 18 }}>
          W ramach oferty masz jeden arkusz — ten poniżej.
        </Text>

        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: radius["2xl"],
            borderWidth: 2,
            borderColor: colors.brand[500] + "66",
            padding: 18,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <View
              style={{
                backgroundColor: colors.brand[500],
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>
                DARMOWY
              </Text>
            </View>
            {done && (
              <View
                style={{
                  backgroundColor: colors.navy[500],
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>
                  ODDANY
                </Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text }}>
            {trial.exam?.title ?? "Arkusz maturalny"}
          </Text>
          {trial.exam && (
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
              {trial.exam.subjectName} · poziom {trial.exam.level.toLowerCase()} ·{" "}
              {trial.exam.timeMinutes} min · {trial.exam.maxPoints} pkt
            </Text>
          )}

          <TouchableOpacity
            onPress={() => {
              if (done && trial.examAttemptId) {
                navigation.navigate("ExamResults", {
                  attemptId: trial.examAttemptId,
                });
              } else {
                navigation.navigate("ExamPlay", {
                  examId: trial.examId!,
                  subjectId: "",
                });
              }
            }}
            style={{
              backgroundColor: colors.brand[500],
              paddingVertical: 13,
              borderRadius: radius.xl,
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {done ? "Zobacz wynik i feedback AI →" : "Wróć do arkusza →"}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: theme.backgroundSecondary,
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginTop: 18,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Pozostałe arkusze — ze wszystkich przedmiotów, bez limitu podejść —
            odblokujesz w Premium.
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.getParent()?.navigate("ProfileTab", {
                screen: "Subscription",
              })
            }
            style={{
              backgroundColor: colors.brand[500],
              paddingVertical: 11,
              paddingHorizontal: 22,
              borderRadius: radius.xl,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
              Zobacz Premium →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Premium gate — wcześniej bez ŻADNEGO CTA (ślepa uliczka); teraz wspólny
  // konwersyjny ekran z przejściem do subskrypcji. Konto z ważną ofertą
  // przechodzi dalej, do katalogu.
  if (isPremium === false && !trial?.active) {
    return <PremiumGate mode="exam" />;
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

      {/* Oferta ważna, arkusz jeszcze nie wybrany. Ostrzeżenie jest istotne:
          wybór jest JEDNORAZOWY, a bez tej informacji uczeń klika w pierwszy
          z brzegu i orientuje się dopiero, gdy nie może otworzyć drugiego. */}
      {isPremium === false && trial?.active && !trial.examId && (
        <View
          style={{
            padding: 14,
            borderRadius: radius["2xl"],
            backgroundColor: colors.brand[500] + "14",
            borderWidth: 1,
            borderColor: colors.brand[500] + "55",
            marginBottom: 18,
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: "800", color: theme.text, marginBottom: 4 }}
          >
            🎁 Masz odblokowany 1 darmowy arkusz
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }}>
            Wybierz dowolny arkusz poniżej — <Text style={{ fontWeight: "800" }}>to wybór
            na raz</Text>, więc weź przedmiot, na którym najbardziej Ci zależy. Masz też{" "}
            {trial.credits} kredytów AI na ocenę zadań otwartych.
          </Text>
        </View>
      )}

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
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: theme.text,
                          }}
                        >
                          {info.subjectName}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 999,
                            backgroundColor:
                              info.level === "ROZSZERZONY"
                                ? "#f3e8ff"
                                : "#e0f2fe",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "800",
                              color:
                                info.level === "ROZSZERZONY"
                                  ? "#9333ea"
                                  : "#0284c7",
                              letterSpacing: 0.3,
                            }}
                          >
                            {info.level}
                          </Text>
                        </View>
                      </View>
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

          {/* Pełna lista arkuszy — wchodzi także w te nieaktywne i już
              rozwiązane, których widok ucznia nie pokazuje. */}
          <AdminExamList
            onOpen={(examId) =>
              navigation.navigate("ExamPlay", { examId, subjectId: "" })
            }
          />

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
