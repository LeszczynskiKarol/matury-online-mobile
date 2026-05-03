// src/screens/profile/RankingScreen.tsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import { getSubjects, type Subject } from "../../api/subjects";
import {
  getLeaderboard,
  getLeaderboardVisibility,
  toggleLeaderboardVisibility,
} from "../../api/gamification";

const TIER_COLORS: Record<string, { border: string; bg: string }> = {
  BRONZE: { border: "#cd7f32", bg: "#cd7f32" },
  SILVER: { border: "#c0c0c0", bg: "#c0c0c0" },
  GOLD: { border: "#ffd700", bg: "#ffd700" },
  PLATINUM: { border: "#b4e4ff", bg: "#b4e4ff" },
  DIAMOND: { border: "#e879f9", bg: "#e879f9" },
};

const medals = ["🥇", "🥈", "🥉"];

function normalize(entry: any) {
  if (entry.user) {
    return {
      rank: entry.rank,
      isCurrentUser: entry.isCurrentUser,
      id: entry.user.id,
      name: entry.user.name,
      avatarUrl: entry.user.avatarUrl,
      totalXp: entry.xp,
      globalLevel: entry.user.globalLevel,
      currentStreak: entry.user.currentStreak,
      title: entry.user.title,
      showcaseBadges: entry.user.showcaseBadges || [],
      level: entry.level,
    };
  }
  return entry;
}

function LeaderRow({
  entry,
  isSubject,
  theme,
  isDark,
}: {
  entry: any;
  isSubject: boolean;
  theme: any;
  isDark: boolean;
}) {
  const xp = isSubject ? entry.totalXp || entry.xp : entry.totalXp;
  const highlight = entry.isCurrentUser;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: highlight
          ? colors.brand[500] + "10"
          : entry.rank <= 3
            ? isDark
              ? "rgba(251,191,36,0.05)"
              : "rgba(251,191,36,0.08)"
            : "transparent",
        borderLeftWidth: highlight ? 3 : 0,
        borderLeftColor: highlight ? colors.brand[500] : "transparent",
      }}
    >
      {/* Rank */}
      <Text
        style={{
          width: 28,
          textAlign: "center",
          fontWeight: "700",
          fontSize: 16,
          color: theme.text,
        }}
      >
        {entry.rank <= 3 ? medals[entry.rank - 1] : entry.rank}
      </Text>

      {/* Avatar */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isDark ? colors.zinc[700] : colors.zinc[200],
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {entry.avatarUrl ? (
          <Image
            source={{ uri: entry.avatarUrl }}
            style={{ width: 36, height: 36, borderRadius: 18 }}
          />
        ) : (
          <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>
            {(entry.name || "?")[0].toUpperCase()}
          </Text>
        )}
      </View>

      {/* Name + title + badges */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          <Text
            style={{
              fontWeight: "600",
              fontSize: 14,
              color: theme.text,
            }}
            numberOfLines={1}
          >
            {entry.name || "Anonim"}
          </Text>
          {highlight && (
            <View
              style={{
                backgroundColor: colors.brand[500] + "20",
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "800",
                  color: colors.brand[500],
                }}
              >
                TY
              </Text>
            </View>
          )}
          {entry.title && (
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 8,
                backgroundColor: entry.title.color + "20",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: entry.title.color,
                }}
              >
                {entry.title.emoji} {entry.title.name}
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 2,
          }}
        >
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>
            Poz. {entry.globalLevel}
          </Text>
          {entry.currentStreak > 0 && (
            <Text style={{ fontSize: 11, color: colors.orange[500] }}>
              🔥{entry.currentStreak}
            </Text>
          )}
          {isSubject && entry.level && (
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>
              Lv. {entry.level}
            </Text>
          )}
          {entry.showcaseBadges?.length > 0 && (
            <View style={{ flexDirection: "row", gap: 2, marginLeft: 2 }}>
              {entry.showcaseBadges.map((b: any) => (
                <View
                  key={b.id}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    backgroundColor:
                      (TIER_COLORS[b.tier]?.bg || "#6366f1") + "25",
                    borderWidth: 1,
                    borderColor:
                      (TIER_COLORS[b.tier]?.border || "#6366f1") + "50",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 10 }}>{b.icon}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* XP */}
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>
          {(xp || 0).toLocaleString()}
        </Text>
        <Text style={{ fontSize: 10, color: theme.textTertiary }}>XP</Text>
      </View>
    </View>
  );
}

export function RankingScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const { user } = useAuth();

  const [tab, setTab] = useState("global");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [data, setData] = useState<{
    leaders: any[];
    currentUserEntry: any;
    type: string;
  } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  const fetchData = useCallback(async () => {
    try {
      const [subs, vis] = await Promise.all([
        getSubjects().catch(() => []),
        getLeaderboardVisibility().catch(() => ({
          hideFromLeaderboard: false,
        })),
      ]);
      setSubjects(subs.filter((s) => s.isActive));
      setHidden(vis.hideFromLeaderboard);
    } catch {}
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const subjectId = tab !== "global" ? tab : undefined;
      const res = await getLeaderboard(subjectId);
      if (res.leaders) {
        setData(res);
      } else {
        setData({
          leaders: res as any,
          currentUserEntry: null,
          type: "global",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [tab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await toggleLeaderboardVisibility();
      setHidden(res.hideFromLeaderboard);
      await fetchLeaderboard();
    } catch {
    } finally {
      setToggling(false);
    }
  };

  const leaders = (data?.leaders || []).map(normalize);
  const currentEntry = data?.currentUserEntry
    ? normalize(data.currentUserEntry)
    : null;
  const isSubject = tab !== "global";

  const scrollToMe = () => {
    const idx = leaders.findIndex((l) => l.isCurrentUser);
    if (idx >= 0 && listRef.current) {
      listRef.current.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: spacing[5],
          paddingBottom: 12,
          backgroundColor: theme.background,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text }}>
            Ranking
          </Text>
          {leaders.some((l) => l.isCurrentUser) && (
            <TouchableOpacity
              onPress={scrollToMe}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: colors.brand[500] + "15",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.brand[500],
                }}
              >
                📍 Znajdź mnie
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Subject tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: 20 }}
        >
          <TouchableOpacity
            onPress={() => setTab("global")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.lg,
              backgroundColor:
                tab === "global"
                  ? colors.brand[500] + "1A"
                  : isDark
                    ? "rgba(255,255,255,0.04)"
                    : colors.zinc[100],
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color:
                  tab === "global" ? colors.brand[500] : theme.textTertiary,
              }}
            >
              🌍 Globalny
            </Text>
          </TouchableOpacity>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setTab(s.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: radius.lg,
                backgroundColor:
                  tab === s.id
                    ? colors.brand[500] + "1A"
                    : isDark
                      ? "rgba(255,255,255,0.04)"
                      : colors.zinc[100],
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: tab === s.id ? colors.brand[500] : theme.textTertiary,
                }}
              >
                {s.icon} {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Visibility toggle */}
      <View
        style={{
          marginHorizontal: spacing[5],
          marginBottom: 8,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: radius.lg,
          backgroundColor: isDark ? colors.surface[800] : colors.zinc[50],
          borderWidth: 1,
          borderColor: isDark ? colors.zinc[700] : colors.zinc[200],
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: theme.text,
            }}
          >
            {hidden ? "🙈 Profil ukryty" : "👁️ Profil widoczny"}
          </Text>
          <Text style={{ fontSize: 10, color: theme.textTertiary }}>
            {hidden ? "Nie pokazujesz się innym" : "Inni widzą Cię w rankingu"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleToggle}
          disabled={toggling}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: hidden
              ? colors.brand[500] + "15"
              : isDark
                ? colors.zinc[700]
                : colors.zinc[200],
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: hidden ? colors.brand[500] : theme.textSecondary,
            }}
          >
            {toggling ? "..." : hidden ? "Pokaż" : "Ukryj"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Current user outside top 50 */}
      {currentEntry && !leaders.some((l) => l.isCurrentUser) && (
        <View
          style={{
            marginHorizontal: spacing[5],
            marginBottom: 8,
            padding: 12,
            borderRadius: radius.lg,
            backgroundColor: colors.brand[500] + "08",
            borderWidth: 1,
            borderColor: colors.brand[500] + "20",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: colors.brand[500],
              marginBottom: 6,
            }}
          >
            📍 Twoja pozycja
          </Text>
          <LeaderRow
            entry={currentEntry}
            isSubject={isSubject}
            theme={theme}
            isDark={isDark}
          />
        </View>
      )}

      {/* Leaderboard list */}
      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: theme.textSecondary }}>Ładowanie...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={leaders}
          keyExtractor={(item) => item.id || String(item.rank)}
          renderItem={({ item }) => (
            <LeaderRow
              entry={item}
              isSubject={isSubject}
              theme={theme}
              isDark={isDark}
            />
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.04)"
                  : colors.zinc[100],
              }}
            />
          )}
          ListEmptyComponent={
            <Text
              style={{
                padding: 32,
                textAlign: "center",
                color: theme.textTertiary,
              }}
            >
              Brak danych rankingu.
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
            />
          }
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
            backgroundColor: isDark ? colors.surface[800] + "80" : "#fff",
            marginHorizontal: spacing[5],
            borderRadius: radius["2xl"],
            overflow: "hidden",
            borderWidth: 1,
            borderColor: isDark
              ? colors.zinc[700] + "4D"
              : colors.zinc[200] + "80",
          }}
          onScrollToIndexFailed={() => {}}
        />
      )}
    </View>
  );
}
