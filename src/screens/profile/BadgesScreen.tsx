// ============================================================================
// Badges Screen — badges, labels, title ladder (mobile)
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { getFlavorText } from "../../lib/badge-flavors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/common/ProgressBar";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import {
  getBadges,
  getLabels,
  getTitle,
  getProfile,
  setShowcase,
  type BadgesResponse,
  type LabelsResponse,
  type TitleResponse,
  type ProfileResponse,
  type BadgeData,
} from "../../api/gamification";

// ── Tier styling ───────────────────────────────────────────────────────────

const TIER_COLORS: Record<
  string,
  { border: string; bg: string; glow: string }
> = {
  BRONZE: { border: "#cd7f32", bg: "#cd7f32", glow: "rgba(205,127,50,0.25)" },
  SILVER: { border: "#c0c0c0", bg: "#c0c0c0", glow: "rgba(192,192,192,0.25)" },
  GOLD: { border: "#ffd700", bg: "#ffd700", glow: "rgba(255,215,0,0.3)" },
  PLATINUM: { border: "#b4e4ff", bg: "#b4e4ff", glow: "rgba(180,228,255,0.3)" },
  DIAMOND: { border: "#e879f9", bg: "#e879f9", glow: "rgba(232,121,249,0.35)" },
};

const TIER_LABELS: Record<string, string> = {
  BRONZE: "Brąz",
  SILVER: "Srebro",
  GOLD: "Złoto",
  PLATINUM: "Platyna",
  DIAMOND: "Diament",
};

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  STREAK: { icon: "🔥", label: "Seria" },
  PERFECT: { icon: "💎", label: "Perfekcja" },
  VOLUME: { icon: "📚", label: "Ilość" },
  MASTERY: { icon: "🎓", label: "Przedmioty" },
  MILESTONE: { icon: "🏆", label: "Milestones" },
  SPECIAL: { icon: "⭐", label: "Specjalne" },
};

// ── Badge card ─────────────────────────────────────────────────────────────

function BadgeCard({
  badge,
  isEarned,
  isShowcased,
  onShowcaseToggle,
  theme,
  isDark,
}: {
  badge: BadgeData;
  isEarned: boolean;
  isShowcased: boolean;
  onShowcaseToggle?: () => void;
  theme: any;
  isDark: boolean;
}) {
  const tier = TIER_COLORS[badge.tier] || TIER_COLORS.BRONZE;
  const flavor = getFlavorText(badge.slug);

  const handlePress = () => {
    if (isEarned && onShowcaseToggle) {
      Alert.alert(
        `${badge.icon} ${badge.name}`,
        `${flavor}\n\n${badge.description}`,
        [
          {
            text: isShowcased
              ? "Usuń z wyróżnionych"
              : "📌 Wyróżnij na profilu",
            onPress: onShowcaseToggle,
          },
          { text: "OK", style: "cancel" },
        ],
      );
    } else {
      // Locked badge — just show info
      Alert.alert(
        `🔒 ${badge.name}`,
        `${flavor}\n\n${badge.description}${badge.progress ? `\n\nPostęp: ${badge.progress.current}/${badge.progress.target}` : ""}`,
        [{ text: "OK" }],
      );
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={{
        padding: 14,
        borderRadius: radius.xl,
        borderWidth: 2,
        borderColor: isEarned
          ? tier.border
          : isDark
            ? "#2a2a3e"
            : colors.zinc[200],
        backgroundColor: isEarned
          ? isDark
            ? "rgba(255,255,255,0.03)"
            : "#fff"
          : isDark
            ? "rgba(0,0,0,0.2)"
            : colors.zinc[50],
        opacity: isEarned ? 1 : 0.55,
        marginBottom: 8,
      }}
    >
      {/* Top accent */}
      {isEarned && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            backgroundColor: tier.bg,
          }}
        />
      )}

      {/* Showcase pin */}
      {isShowcased && (
        <View style={{ position: "absolute", top: 8, right: 10 }}>
          <Text style={{ fontSize: 12 }}>📌</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {/* Icon */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.lg,
            backgroundColor: isEarned
              ? tier.bg
              : isDark
                ? "#1e1e30"
                : colors.zinc[200],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 24 }}>{isEarned ? badge.icon : "🔒"}</Text>
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 2,
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                fontSize: 14,
                color: isEarned ? theme.text : theme.textTertiary,
              }}
            >
              {badge.name}
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 6,
                backgroundColor: isEarned
                  ? tier.bg + "30"
                  : isDark
                    ? "#2a2a3e"
                    : colors.zinc[200],
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: isEarned ? tier.border : theme.textTertiary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {TIER_LABELS[badge.tier]}
              </Text>
            </View>
          </View>

          <Text
            style={{ fontSize: 12, color: theme.textSecondary }}
            numberOfLines={1}
          >
            {badge.description}
          </Text>

          {isEarned && badge.xpReward > 0 && (
            <View
              style={{
                marginTop: 4,
                backgroundColor: theme.xpBg,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 99,
                alignSelf: "flex-start",
              }}
            >
              <Text
                style={{ fontSize: 11, fontWeight: "600", color: theme.xpText }}
              >
                +{badge.xpReward} XP
              </Text>
            </View>
          )}

          {/* Progress bar */}
          {!isEarned && badge.progress && (
            <View style={{ marginTop: 6 }}>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isDark ? "#2a2a3e" : colors.zinc[200],
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    width: `${(badge.progress.current / badge.progress.target) * 100}%`,
                    backgroundColor: tier.bg,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color: theme.textTertiary,
                  marginTop: 3,
                }}
              >
                {badge.progress.current}/{badge.progress.target}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const { user } = useAuth();

  const [tab, setTab] = useState<"badges" | "labels" | "titles">("badges");
  const [activeCat, setActiveCat] = useState("STREAK");
  const [badgeData, setBadgeData] = useState<BadgesResponse | null>(null);
  const [labelData, setLabelData] = useState<LabelsResponse | null>(null);
  const [titleData, setTitleData] = useState<TitleResponse | null>(null);
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [showcaseIds, setShowcaseIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [b, l, t, p] = await Promise.all([
        getBadges(),
        getLabels(),
        getTitle(),
        getProfile(),
      ]);
      setBadgeData(b);
      setLabelData(l);
      setTitleData(t);
      setProfileData(p);
      setShowcaseIds(p.showcaseBadgeIds || []);
    } catch (err) {
      console.error("Badges fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const toggleShowcase = async (badgeId: string) => {
    let next: string[];
    if (showcaseIds.includes(badgeId)) {
      next = showcaseIds.filter((id) => id !== badgeId);
    } else if (showcaseIds.length < 3) {
      next = [...showcaseIds, badgeId];
    } else {
      Alert.alert("Maks. 3", "Możesz wyróżnić maksymalnie 3 odznaki.");
      return;
    }
    setShowcaseIds(next);
    await setShowcase(next).catch(console.error);
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
        <Text style={{ color: theme.textSecondary }}>Ładowanie...</Text>
      </View>
    );
  }

  const categories = Object.keys(CATEGORY_META);

  // Group badges
  const earnedByCategory: Record<string, BadgeData[]> = {};
  const lockedByCategory: Record<string, BadgeData[]> = {};
  for (const cat of categories) {
    earnedByCategory[cat] =
      badgeData?.earned.filter((b) => b.category === cat) || [];
    lockedByCategory[cat] =
      badgeData?.locked.filter((b) => b.category === cat) || [];
  }

  // Closest badge to unlock
  const closestBadge = badgeData?.locked
    .filter((b) => b.progress)
    .sort(
      (a, b) =>
        b.progress!.current / b.progress!.target -
        a.progress!.current / a.progress!.target,
    )[0];

  const tabs = [
    { id: "badges" as const, label: "🏅 Odznaki" },
    { id: "labels" as const, label: "🏷️ Etykiety" },
    { id: "titles" as const, label: "🐐 Tytuły" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand[500]}
        />
      }
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: theme.text,
          marginBottom: 16,
        }}
      >
        Odznaki & Etykiety
      </Text>

      {/* Tab bar */}
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 20 }}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.lg,
              backgroundColor:
                tab === t.id ? colors.brand[500] + "1A" : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: tab === t.id ? colors.brand[500] : theme.textTertiary,
              }}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ═══ BADGES TAB ═══ */}
      {tab === "badges" && badgeData && (
        <View>
          {/* Stats */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <Card variant="stat" style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.navy[500],
                }}
              >
                {badgeData.stats.earned}/{badgeData.stats.total}
              </Text>
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                Zdobyte
              </Text>
            </Card>
            <Card variant="stat" style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.yellow[500],
                }}
              >
                {badgeData.stats.byTier?.GOLD || 0}
              </Text>
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                Złote
              </Text>
            </Card>
            <Card variant="stat" style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{ fontSize: 22, fontWeight: "800", color: "#e879f9" }}
              >
                {badgeData.stats.byTier?.DIAMOND || 0}
              </Text>
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                Diamentowe
              </Text>
            </Card>
          </View>

          {/* Category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 16 }}
            contentContainerStyle={{ gap: 6 }}
          >
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat];
              const earned = earnedByCategory[cat]?.length || 0;
              const total = earned + (lockedByCategory[cat]?.length || 0);
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCat(cat)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor:
                      activeCat === cat
                        ? colors.brand[500] + "1A"
                        : isDark
                          ? "rgba(255,255,255,0.04)"
                          : colors.zinc[100],
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{meta.icon}</Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color:
                        activeCat === cat
                          ? colors.brand[500]
                          : theme.textTertiary,
                    }}
                  >
                    {meta.label}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                      borderRadius: 8,
                      backgroundColor:
                        activeCat === cat
                          ? colors.brand[500] + "20"
                          : isDark
                            ? "rgba(255,255,255,0.06)"
                            : colors.zinc[200],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: theme.textTertiary,
                      }}
                    >
                      {earned}/{total}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Badge list */}
          {(earnedByCategory[activeCat] || []).map((badge) => (
            <BadgeCard
              key={badge.slug}
              badge={badge}
              isEarned
              isShowcased={showcaseIds.includes(badge.id)}
              onShowcaseToggle={() => toggleShowcase(badge.id)}
              theme={theme}
              isDark={isDark}
            />
          ))}
          {(lockedByCategory[activeCat] || []).map((badge) => (
            <BadgeCard
              key={badge.slug}
              badge={badge}
              isEarned={false}
              isShowcased={false}
              theme={theme}
              isDark={isDark}
            />
          ))}

          {/* Next unlock hint */}
          {closestBadge && (
            <Card
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.brand[500] + "40",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.brand[500],
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 4,
                }}
              >
                💡 Następna odznaka w zasięgu
              </Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                <Text style={{ fontWeight: "700", color: theme.text }}>
                  {closestBadge.name}
                </Text>
                {" — jeszcze "}
                {closestBadge.progress!.target - closestBadge.progress!.current}
                {" do odblokowania!"}
              </Text>
            </Card>
          )}
        </View>
      )}

      {/* ═══ LABELS TAB ═══ */}
      {tab === "labels" && labelData && (
        <View>
          <Card style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                lineHeight: 20,
              }}
            >
              Etykiety to dynamiczne labele widoczne przy Twoim profilu w
              rankingu. Odświeżają się automatycznie — tracisz serię, etykieta
              znika.
            </Text>
          </Card>

          {/* Active */}
          {labelData.active.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: theme.textSecondary,
                  marginBottom: 10,
                }}
              >
                Twoje aktywne
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {labelData.active.map((l) => (
                  <View
                    key={l.id}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: l.color + "30",
                      backgroundColor: l.color + "15",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: l.color,
                      }}
                    >
                      {l.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* All */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: theme.textSecondary,
              marginBottom: 10,
            }}
          >
            Wszystkie etykiety
          </Text>
          {labelData.all.map((l) => (
            <View
              key={l.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: radius.lg,
                backgroundColor: l.isActive
                  ? isDark
                    ? "rgba(255,255,255,0.03)"
                    : "#fff"
                  : isDark
                    ? "rgba(0,0,0,0.15)"
                    : colors.zinc[50],
                opacity: l.isActive ? 1 : 0.5,
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: l.isActive ? l.color : theme.textTertiary,
                }}
              >
                {l.text}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: l.isActive
                    ? colors.brand[500] + "1A"
                    : isDark
                      ? colors.zinc[800]
                      : colors.zinc[200],
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: l.isActive ? colors.brand[500] : theme.textTertiary,
                  }}
                >
                  {l.isActive ? "AKTYWNA" : "ZABLOKOWANA"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ═══ TITLES TAB ═══ */}
      {tab === "titles" && titleData && (
        <View>
          {/* Current title + progress */}
          <Card style={{ marginBottom: 20 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.lg,
                  backgroundColor: titleData.current.color + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>{titleData.current.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                  Aktualny tytuł
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: titleData.current.color,
                  }}
                >
                  {titleData.current.name}
                </Text>
              </View>
            </View>

            {titleData.next && (
              <View
                style={{
                  padding: 12,
                  borderRadius: radius.lg,
                  backgroundColor: isDark ? "rgba(0,0,0,0.3)" : colors.zinc[50],
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                    <Text
                      style={{
                        fontWeight: "700",
                        color: titleData.current.color,
                      }}
                    >
                      {titleData.current.emoji} {titleData.current.name}
                    </Text>
                    {"  →  "}
                    <Text
                      style={{
                        fontWeight: "700",
                        color: titleData.next.next.color,
                      }}
                    >
                      {titleData.next.next.emoji} {titleData.next.next.name}
                    </Text>
                  </Text>
                </View>
                <ProgressBar
                  progress={titleData.next.progress * 100}
                  height={6}
                  color={titleData.next.next.color}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: theme.textTertiary,
                    marginTop: 4,
                  }}
                >
                  Poziom {titleData.globalLevel} /{" "}
                  {titleData.next.next.minLevel}
                </Text>
              </View>
            )}
          </Card>

          {/* Title ladder */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: theme.textSecondary,
              marginBottom: 10,
            }}
          >
            Drabina tytułów
          </Text>
          {titleData.allTitles.map((t: any) => (
            <View
              key={t.name}
              style={{
                paddingHorizontal: 14,
                paddingVertical: t.reached && t.flavorText ? 10 : 10,
                borderRadius: radius.lg,
                backgroundColor: t.reached
                  ? isDark
                    ? "rgba(255,255,255,0.03)"
                    : "#fff"
                  : isDark
                    ? "rgba(0,0,0,0.15)"
                    : colors.zinc[50],
                borderWidth: t.isCurrent ? 1 : 0,
                borderColor: t.isCurrent ? t.color + "50" : "transparent",
                opacity: t.reached ? 1 : 0.4,
                marginBottom: 6,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: t.reached
                      ? t.color + "20"
                      : isDark
                        ? "#1e1e30"
                        : colors.zinc[200],
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: t.reached
                      ? t.color + "40"
                      : isDark
                        ? "#2a2a3e"
                        : colors.zinc[300],
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontWeight: "700",
                    fontSize: 14,
                    color: t.reached ? t.color : theme.textTertiary,
                  }}
                >
                  {t.name}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                  Poz. {t.minLevel}+
                </Text>
                {t.isCurrent && <Text style={{ fontSize: 14 }}>◀</Text>}
                {t.reached && !t.isCurrent && (
                  <Text style={{ fontSize: 14, color: colors.brand[500] }}>
                    ✓
                  </Text>
                )}
              </View>

              {t.reached && t.flavorText && (
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.textTertiary,
                    fontStyle: "italic",
                    marginTop: 6,
                    marginLeft: 48,
                    lineHeight: 16,
                  }}
                >
                  "{t.flavorText}"
                </Text>
              )}
            </View>
          ))}

          {/* Showcase badges */}
          {profileData && (
            <View style={{ marginTop: 24 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: theme.textSecondary,
                  marginBottom: 10,
                }}
              >
                Wyróżnione odznaki
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.textTertiary,
                  marginBottom: 10,
                }}
              >
                Kliknij odznakę w zakładce Odznaki, aby dodać/usunąć
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {profileData.showcaseBadges.map((b) => {
                  const tier = TIER_COLORS[b.tier] || TIER_COLORS.BRONZE;
                  return (
                    <View
                      key={b.id}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: radius.lg,
                        backgroundColor: tier.bg + "30",
                        borderWidth: 2,
                        borderColor: tier.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{b.icon}</Text>
                    </View>
                  );
                })}
                {Array.from({
                  length: 3 - (profileData.showcaseBadges?.length || 0),
                }).map((_, i) => (
                  <View
                    key={`empty-${i}`}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.lg,
                      borderWidth: 2,
                      borderStyle: "dashed",
                      borderColor: isDark ? "#2a2a3e" : colors.zinc[300],
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, color: theme.textTertiary }}>
                      +
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
