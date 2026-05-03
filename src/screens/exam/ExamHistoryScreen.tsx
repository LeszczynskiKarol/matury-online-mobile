// src/screens/exam/ExamHistoryScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { getExamHistory, type ExamAttemptHistory } from "../../api/exams";
import type { ExamStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ExamStackParamList>;

function getTierColor(pct: number) {
  if (pct >= 85) return "#059669";
  if (pct >= 65) return "#2563eb";
  if (pct >= 50) return "#d97706";
  if (pct >= 30) return "#ea580c";
  return "#dc2626";
}

export function ExamHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const [attempts, setAttempts] = useState<ExamAttemptHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExamHistory(50)
      .then(setAttempts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  const inProgress = attempts.filter((a) => a.status === "IN_PROGRESS");
  const grading = attempts.filter((a) => a.status === "GRADING");
  const completed = attempts.filter((a) => a.status === "COMPLETED");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 100,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text }}>
            Historia egzaminów
          </Text>
          <Text
            style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}
          >
            {attempts.length} egzaminów
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>
            ← Wróć
          </Text>
        </TouchableOpacity>
      </View>

      {attempts.length === 0 && (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
            Brak historii
          </Text>
          <Text
            style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}
          >
            Rozpocznij swój pierwszy egzamin!
          </Text>
        </View>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#f59e0b",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            ● W TRAKCIE ({inProgress.length})
          </Text>
          {inProgress.map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() =>
                navigation.navigate("ExamPlay", {
                  examId: a.exam.id,
                  subjectId: "",
                })
              }
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: theme.card,
                borderLeftWidth: 4,
                borderLeftColor: "#f59e0b",
                marginBottom: 8,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: theme.text }}
              >
                {a.exam.title}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.textTertiary,
                  marginTop: 4,
                }}
              >
                Rozpoczęto: {new Date(a.startedAt).toLocaleDateString("pl")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Grading */}
      {grading.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#a855f7",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            ● OCENIANIE ({grading.length})
          </Text>
          {grading.map((a) => (
            <View
              key={a.id}
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: theme.card,
                borderLeftWidth: 4,
                borderLeftColor: "#a855f7",
                marginBottom: 8,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: theme.text }}
              >
                {a.exam.title}
              </Text>
              <Text style={{ fontSize: 11, color: "#a855f7", marginTop: 4 }}>
                Trwa ocena AI...
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <View>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: theme.textTertiary,
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            UKOŃCZONE ({completed.length})
          </Text>
          {completed.map((a) => {
            const pct = a.percentage ?? 0;
            const clr = getTierColor(pct);
            return (
              <TouchableOpacity
                key={a.id}
                onPress={() =>
                  navigation.navigate("ExamResults", { attemptId: a.id })
                }
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: theme.card,
                  borderLeftWidth: 4,
                  borderLeftColor: clr,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: theme.text,
                      }}
                    >
                      {a.exam.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textTertiary,
                        marginTop: 4,
                      }}
                    >
                      {a.completedAt
                        ? new Date(a.completedAt).toLocaleDateString("pl")
                        : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{ fontSize: 18, fontWeight: "800", color: clr }}
                    >
                      {a.totalScore ?? 0}/{a.exam.maxPoints}
                    </Text>
                    <Text
                      style={{ fontSize: 11, fontWeight: "600", color: clr }}
                    >
                      {pct}% — {pct >= 30 ? "zdany" : "niezdany"}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    height: 4,
                    backgroundColor: theme.border,
                    borderRadius: 2,
                    marginTop: 10,
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: clr,
                      width: `${pct}%`,
                    }}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
