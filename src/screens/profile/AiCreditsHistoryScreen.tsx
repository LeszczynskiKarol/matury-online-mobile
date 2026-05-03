// src/screens/profile/AiCreditsHistoryScreen.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { getAiCreditsHistory, type AiCreditEntry } from "../../api/aiCredits";

const TYPE_ICONS: Record<string, string> = {
  EXAM_GRADING: "📝",
  QUIZ_ANSWER: "🎯",
  ESSAY_GRADING: "✍️",
  LISTENING_GENERATION: "🎧",
  SUBSCRIPTION_MONTHLY: "💎",
  SUBSCRIPTION_ONETIME: "💎",
  ADMIN_GRANT: "🎁",
  BONUS: "🎁",
};

export function AiCreditsHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation();

  const [entries, setEntries] = useState<AiCreditEntry[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<
    { month: string; used: number; added: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    getAiCreditsHistory(1, 30)
      .then((data) => {
        setEntries(data.entries);
        setMonthlyStats(data.monthlyStats || []);
        setHasMore(data.hasMore);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await getAiCreditsHistory(nextPage, 30);
      setEntries((prev) => [...prev, ...data.entries]);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch {}
    setLoadingMore(false);
  }, [page, hasMore, loadingMore]);

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
            Historia kredytów
          </Text>
          <Text
            style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}
          >
            💎 Zużycie AI kredytów
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>
            ← Wróć
          </Text>
        </TouchableOpacity>
      </View>

      {/* Monthly stats */}
      {monthlyStats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
        >
          <View style={{ flexDirection: "row", gap: 10 }}>
            {monthlyStats.map((m) => (
              <View
                key={m.month}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  minWidth: 120,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: theme.text,
                    marginBottom: 6,
                  }}
                >
                  {m.month}
                </Text>
                {m.added > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.brand[500],
                      fontWeight: "600",
                    }}
                  >
                    +{m.added} dodane
                  </Text>
                )}
                {m.used > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#ef4444",
                      fontWeight: "600",
                    }}
                  >
                    -{m.used} zużyte
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>💎</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
            Brak historii
          </Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {entries.map((entry) => {
            const isPositive = entry.credits > 0;
            return (
              <View
                key={entry.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <Text style={{ fontSize: 20 }}>
                  {TYPE_ICONS[entry.type] || "💎"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: theme.text,
                    }}
                  >
                    {entry.label}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                    <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                      {new Date(entry.createdAt).toLocaleDateString("pl", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    {entry.context && (
                      <Text
                        style={{ fontSize: 10, color: theme.textTertiary }}
                        numberOfLines={1}
                      >
                        {entry.context}
                      </Text>
                    )}
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                    color: isPositive ? colors.brand[500] : "#ef4444",
                  }}
                >
                  {isPositive ? "+" : ""}
                  {entry.credits}
                </Text>
              </View>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <TouchableOpacity
              onPress={loadMore}
              disabled={loadingMore}
              style={{ alignItems: "center", paddingVertical: 16 }}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.brand[500]} />
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.brand[500],
                  }}
                >
                  Pokaż więcej
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}
