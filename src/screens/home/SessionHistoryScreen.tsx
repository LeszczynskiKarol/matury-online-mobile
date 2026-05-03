// ============================================================================
// Session History Screen — lista sesji + szczegóły z timeline pytań
// File: src/screens/home/SessionHistoryScreen.tsx
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import {
  getMySessionHistory,
  getSessionDetail,
  type SessionSummary,
  type SessionDetailData,
  type SessionTimelineItem,
} from "../../api/sessionHistory";

// ── Hardcoded colors missing from palette ─────────────────────────────────
const PURPLE = "#a855f7";
const PURPLE_DARK = "#9333ea";
const PURPLE_LIGHT = "#c084fc";

// ── Mappings ──────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  ANSWERED: {
    label: "Odpowiedziano",
    icon: "create-outline",
    color: colors.brand[500],
    bg: colors.brand[500] + "15",
  },
  SKIPPED: {
    label: "Pominięto",
    icon: "play-skip-forward-outline",
    color: colors.zinc[500],
    bg: colors.zinc[500] + "15",
  },
  REVEALED: {
    label: "Podejrzano",
    icon: "eye-outline",
    color: colors.yellow[500],
    bg: colors.yellow[500] + "15",
  },
  VIEWED: {
    label: "Wyświetlono",
    icon: "eye-off-outline",
    color: colors.zinc[400],
    bg: colors.zinc[400] + "10",
  },
};

const TYPE_LABELS: Record<string, string> = {
  CLOSED: "Zamknięte",
  MULTI_SELECT: "Wielokrotne",
  TRUE_FALSE: "P/F",
  OPEN: "Otwarte",
  FILL_IN: "Uzupełnij",
  MATCHING: "Dopasuj",
  ORDERING: "Kolejność",
  WIAZKA: "Wiązka",
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

const DIFF_COLORS = [
  "",
  colors.brand[500],
  colors.navy[400],
  colors.yellow[500],
  colors.orange[500],
  colors.red[500],
];
const DIFF_LABELS = ["", "Łatwe", "Podstawa", "Średnie", "Trudne", "Ekspert"];

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  if (min < 60) return s > 0 ? `${min}min ${s}s` : `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripHtml(text: string): string {
  return text?.replace(/<[^>]*>/g, "")?.replace(/&[^;]+;/g, " ") || "";
}

function getQuestionText(content: any): string {
  const raw =
    content?.question ||
    content?.instruction ||
    content?.prompt ||
    (content?.context ? content.context.substring(0, 100) : "(brak treści)");
  return stripHtml(typeof raw === "string" ? raw : JSON.stringify(raw));
}

// ── Main Component ────────────────────────────────────────────────────────

export function SessionHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const LIMIT = 15;

  const fetchSessions = useCallback(async (newOffset = 0, append = false) => {
    try {
      const data = await getMySessionHistory({
        limit: LIMIT,
        offset: newOffset,
      });
      if (append) {
        setSessions((prev) => [...prev, ...data.sessions]);
      } else {
        setSessions(data.sessions);
      }
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err) {
      console.error("Session history fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchSessions(0).finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions(0);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || sessions.length >= total) return;
    setLoadingMore(true);
    await fetchSessions(offset + LIMIT, true);
    setLoadingMore(false);
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setExpandedItems(new Set());
    try {
      const data = await getSessionDetail(id);
      setDetail(data);
    } catch (err) {
      console.error("Session detail error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const toggleItem = (idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════
  if (selectedId) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: spacing[4],
        }}
      >
        <TouchableOpacity
          onPress={closeDetail}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
            paddingVertical: 4,
          }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
            Wróć do listy
          </Text>
        </TouchableOpacity>

        {detailLoading ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 60,
            }}
          >
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text
              style={{
                color: theme.textSecondary,
                marginTop: 12,
                fontSize: 13,
              }}
            >
              Ładowanie szczegółów...
            </Text>
          </View>
        ) : !detail ? (
          <Text
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            Nie znaleziono sesji.
          </Text>
        ) : (
          <>
            {/* Session header */}
            <View style={{ marginBottom: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 22 }}>
                  {detail.session.subject.icon}
                </Text>
                <Text
                  style={{ fontSize: 20, fontWeight: "700", color: theme.text }}
                >
                  {detail.session.subject.name}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                {formatDate(detail.session.startedAt)}
                {detail.session.completedAt &&
                  ` — ${new Date(detail.session.completedAt).toLocaleTimeString("pl", { hour: "2-digit", minute: "2-digit" })}`}
              </Text>
            </View>

            {/* Stats row */}
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <StatPill
                label="Odpowiedzi"
                value={detail.stats.answered}
                color={colors.brand[500]}
              />
              <StatPill
                label="Pominięte"
                value={detail.stats.skipped}
                color={colors.zinc[500]}
              />
              <StatPill
                label="Podejrzane"
                value={detail.stats.revealed}
                color={colors.yellow[500]}
              />
              <StatPill
                label="AI kr."
                value={detail.stats.totalAiCredits}
                color={PURPLE}
              />
              <StatPill
                label="XP"
                value={detail.stats.totalXp}
                color={colors.navy[500]}
              />
            </View>

            {/* Accuracy bar */}
            {detail.session.questionsAnswered > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor:
                        detail.session.accuracy >= 80
                          ? colors.brand[500] + "20"
                          : detail.session.accuracy >= 50
                            ? colors.yellow[500] + "20"
                            : colors.red[500] + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "800",
                        color:
                          detail.session.accuracy >= 80
                            ? colors.brand[600]
                            : detail.session.accuracy >= 50
                              ? colors.yellow[500]
                              : colors.red[500],
                      }}
                    >
                      {detail.session.accuracy}%
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: theme.text,
                      }}
                    >
                      Celność
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      {detail.session.correctAnswers}/
                      {detail.session.questionsAnswered} poprawnych
                      {detail.session.totalTimeMs > 0 &&
                        ` · ${formatDuration(detail.session.totalTimeMs)}`}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Expand/collapse all */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: theme.text }}
              >
                Timeline ({detail.timeline.length})
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={() =>
                    setExpandedItems(new Set(detail.timeline.map((_, i) => i)))
                  }
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: colors.brand[500],
                    }}
                  >
                    Rozwiń
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setExpandedItems(new Set())}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: theme.textTertiary,
                    }}
                  >
                    Zwiń
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Timeline items */}
            {detail.timeline.map((item, idx) => (
              <TimelineItemCard
                key={`${item.questionId}-${idx}`}
                item={item}
                index={idx}
                expanded={expandedItems.has(idx)}
                onToggle={() => toggleItem(idx)}
                theme={theme}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[4],
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand[500]}
        />
      }
      onMomentumScrollEnd={(e) => {
        const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
        if (
          contentOffset.y + layoutMeasurement.height >=
          contentSize.height - 100
        ) {
          loadMore();
        }
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: "700", color: theme.text }}>
            Historia sesji
          </Text>
        </View>
        {!loading && (
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>
            {total} sesji
          </Text>
        )}
      </View>

      {loading ? (
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>📭</Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>
            Brak sesji
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            Rozpocznij sesję nauki, aby zobaczyć historię.
          </Text>
        </View>
      ) : (
        <>
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onPress={() => openDetail(s.id)}
              theme={theme}
            />
          ))}
          {loadingMore && (
            <ActivityIndicator
              size="small"
              color={colors.brand[500]}
              style={{ marginVertical: 16 }}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SESSION CARD
// ══════════════════════════════════════════════════════════════════════════

function SessionCard({
  session,
  onPress,
  theme,
}: {
  session: SessionSummary;
  onPress: () => void;
  theme: any;
}) {
  const bd = session.actionBreakdown;
  const answered = bd.ANSWERED || 0;
  const skipped = bd.SKIPPED || 0;
  const revealed = bd.REVEALED || 0;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: (session.subject.color || "#6366f1") + "15",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20 }}>{session.subject.icon}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: theme.text }}
              >
                {session.subject.name}
              </Text>

              {session.status === "IN_PROGRESS" && (
                <View
                  style={{
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 6,
                    backgroundColor: colors.yellow[500] + "20",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: colors.yellow[500],
                    }}
                  >
                    W trakcie
                  </Text>
                </View>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 4,
                flexWrap: "wrap",
                marginBottom: 4,
              }}
            >
              {answered > 0 && (
                <MiniPill
                  label={`✏️ ${answered}`}
                  bg={colors.brand[500] + "15"}
                  color={colors.brand[500]}
                />
              )}
              {session.correctAnswers > 0 && (
                <MiniPill
                  label={`✅ ${session.correctAnswers}`}
                  bg={colors.brand[500] + "15"}
                  color={colors.brand[600]}
                />
              )}
              {skipped > 0 && (
                <MiniPill
                  label={`⏭ ${skipped}`}
                  bg={colors.zinc[500] + "12"}
                  color={colors.zinc[500]}
                />
              )}
              {revealed > 0 && (
                <MiniPill
                  label={`👁 ${revealed}`}
                  bg={colors.yellow[500] + "15"}
                  color={colors.yellow[500]}
                />
              )}
              {session.aiCreditsUsed > 0 && (
                <MiniPill
                  label={`🤖 ${session.aiCreditsUsed}`}
                  bg={PURPLE + "15"}
                  color={PURPLE}
                />
              )}
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                {formatDate(session.startedAt)}
              </Text>
              {session.totalTimeMs > 0 && (
                <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                  · {formatDuration(session.totalTimeMs)}
                </Text>
              )}
              {session.accuracy > 0 && (
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color:
                      session.accuracy >= 80
                        ? colors.brand[500]
                        : session.accuracy >= 50
                          ? colors.yellow[500]
                          : colors.red[500],
                  }}
                >
                  · {session.accuracy}%
                </Text>
              )}
            </View>
          </View>

          <View
            style={{ alignItems: "flex-end", justifyContent: "center", gap: 4 }}
          >
            {session.totalXpEarned > 0 && (
              <Badge variant="xp" value={`+${session.totalXpEarned}`} />
            )}
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.textTertiary}
            />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TIMELINE ITEM
// ══════════════════════════════════════════════════════════════════════════

function TimelineItemCard({
  item,
  index,
  expanded,
  onToggle,
  theme,
}: {
  item: SessionTimelineItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  theme: any;
}) {
  const action = ACTION_CONFIG[item.action] || ACTION_CONFIG.VIEWED;
  const q = item.question;
  const content = q.content as any;
  const questionText = getQuestionText(content);

  return (
    <Card style={{ marginBottom: 8, padding: 0, overflow: "hidden" }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        style={{ padding: 14, flexDirection: "row", gap: 10 }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            backgroundColor: theme.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: theme.textSecondary,
            }}
          >
            {index + 1}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: action.bg,
              }}
            >
              <Ionicons
                name={action.icon as any}
                size={10}
                color={action.color}
              />
              <Text
                style={{ fontSize: 9, fontWeight: "700", color: action.color }}
              >
                {action.label}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: theme.background,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "600",
                  color: theme.textTertiary,
                }}
              >
                {TYPE_LABELS[q.type] || q.type}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: DIFF_COLORS[q.difficulty] + "15",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: DIFF_COLORS[q.difficulty],
                }}
              >
                {DIFF_LABELS[q.difficulty]}
              </Text>
            </View>
            {item.action === "ANSWERED" && item.isCorrect !== null && (
              <Text style={{ fontSize: 10 }}>
                {item.isCorrect
                  ? "✅"
                  : item.score && item.score > 0
                    ? `⚠️${Math.round(item.score * 100)}%`
                    : "❌"}
              </Text>
            )}
            {item.aiCreditsUsed > 0 && (
              <MiniPill
                label={`🤖 ${item.aiCreditsUsed}kr`}
                bg={PURPLE + "15"}
                color={PURPLE}
              />
            )}
          </View>

          <Text numberOfLines={1} style={{ fontSize: 13, color: theme.text }}>
            {questionText}
          </Text>
          <Text
            style={{ fontSize: 10, color: theme.textTertiary, marginTop: 2 }}
          >
            {q.topic.name}
          </Text>
        </View>

        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.textTertiary}
          style={{ alignSelf: "center" }}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.borderLight || theme.border,
            padding: 14,
            gap: 12,
          }}
        >
          {/* Meta */}
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {item.timeSpentMs != null && item.timeSpentMs > 0 && (
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                ⏱ {formatDuration(item.timeSpentMs)}
              </Text>
            )}
            {q.source && (
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                📄 {q.source}
              </Text>
            )}
            {item.xpEarned > 0 && (
              <Text
                style={{
                  fontSize: 11,
                  color: colors.brand[500],
                  fontWeight: "600",
                }}
              >
                +{item.xpEarned} XP
              </Text>
            )}
          </View>

          {/* Work / epoch */}
          {(content.work || content.epochLabel) && (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {content.work && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: PURPLE + "15",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: PURPLE_DARK,
                    }}
                  >
                    📚 {content.work}
                  </Text>
                </View>
              )}
              {content.epochLabel && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: colors.navy[500] + "15",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: colors.navy[500],
                    }}
                  >
                    {content.epochLabel}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Full question */}
          <View
            style={{
              padding: 12,
              borderRadius: radius.xl,
              backgroundColor: theme.background,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                color: theme.textTertiary,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Treść pytania
            </Text>
            <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
              {questionText}
            </Text>

            {content.options && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {content.options.map((o: any) => {
                  const isCorrectOpt =
                    (q.type === "CLOSED" && o.id === content.correctAnswer) ||
                    (q.type === "MULTI_SELECT" &&
                      content.correctAnswers?.includes(o.id));
                  const wasUserPick =
                    item.response === o.id ||
                    (Array.isArray(item.response) &&
                      item.response.includes(o.id));
                  return (
                    <View
                      key={o.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor: isCorrectOpt
                          ? colors.brand[500] + "12"
                          : wasUserPick
                            ? colors.red[500] + "12"
                            : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: theme.textSecondary,
                          width: 18,
                        }}
                      >
                        {o.id}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: theme.text, flex: 1 }}
                      >
                        {stripHtml(o.text)}
                      </Text>
                      {isCorrectOpt && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.brand[500],
                            fontWeight: "700",
                          }}
                        >
                          ✓
                        </Text>
                      )}
                      {wasUserPick && !isCorrectOpt && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.red[500],
                            fontWeight: "700",
                          }}
                        >
                          ✗
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {content.statements && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {content.statements.map((s: any, i: number) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: theme.card,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.text, flex: 1 }}>
                      {s.text}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: s.isTrue
                          ? colors.brand[500]
                          : colors.red[500],
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: "#fff",
                        }}
                      >
                        {s.isTrue ? "P" : "F"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {content.pairs && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {content.pairs.map((p: any, i: number) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: theme.card,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: theme.text,
                        flex: 1,
                      }}
                    >
                      {stripHtml(p.left)}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                      →
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: colors.brand[500],
                        flex: 1,
                        textAlign: "right",
                      }}
                    >
                      {p.right}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* User response */}
          {item.action === "ANSWERED" && item.response !== null && (
            <View
              style={{
                padding: 12,
                borderRadius: radius.xl,
                backgroundColor: colors.navy[400] + "10",
                borderWidth: 1,
                borderColor: colors.navy[400] + "25",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: colors.navy[400],
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Twoja odpowiedź
              </Text>
              <Text style={{ fontSize: 13, color: theme.text }}>
                {typeof item.response === "string"
                  ? item.response
                  : JSON.stringify(item.response, null, 2)}
              </Text>
            </View>
          )}

          {/* AI Grading */}
          {item.aiGrading && (
            <View
              style={{
                padding: 12,
                borderRadius: radius.xl,
                backgroundColor: PURPLE + "08",
                borderWidth: 1,
                borderColor: PURPLE + "20",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontSize: 12 }}>🤖</Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: PURPLE,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Ocena AI
                </Text>
                {item.aiCreditsUsed > 0 && (
                  <Text
                    style={{
                      fontSize: 9,
                      color: PURPLE_LIGHT,
                      marginLeft: "auto",
                    }}
                  >
                    {item.aiCreditsUsed} kr.
                  </Text>
                )}
              </View>
              {item.aiGrading?.feedback && (
                <Text
                  style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}
                >
                  {item.aiGrading.feedback}
                </Text>
              )}
              {(item.aiGrading?.blanks ||
                item.aiGrading?.subQuestions ||
                item.aiGrading?.fields) && (
                <View style={{ marginTop: 6, gap: 4 }}>
                  {Object.entries(
                    item.aiGrading?.blanks ||
                      item.aiGrading?.subQuestions ||
                      item.aiGrading?.fields ||
                      {},
                  ).map(([k, r]: [string, any]) => (
                    <View
                      key={k}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor:
                          r.score >= 0.5
                            ? colors.brand[500] + "08"
                            : colors.red[500] + "08",
                      }}
                    >
                      <Text style={{ fontSize: 11, color: theme.text }}>
                        {r.score >= 0.5 ? "✅" : "❌"}{" "}
                        <Text style={{ fontWeight: "700" }}>{k}</Text>
                        {r.pointsEarned !== undefined &&
                          ` (${r.pointsEarned} pkt)`}
                        : {r.feedback}
                      </Text>
                      {r.correctAnswer && (
                        <Text
                          style={{
                            fontSize: 10,
                            color: colors.navy[400],
                            marginTop: 2,
                          }}
                        >
                          Wzorcowa: {r.correctAnswer}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Explanation */}
          {q.explanation && q.explanation.length > 10 && (
            <View
              style={{
                padding: 12,
                borderRadius: radius.xl,
                backgroundColor: colors.navy[500] + "08",
                borderWidth: 1,
                borderColor: colors.navy[500] + "20",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: colors.navy[500],
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Wyjaśnienie
              </Text>
              <Text style={{ fontSize: 12, color: theme.text, lineHeight: 18 }}>
                {stripHtml(q.explanation)}
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function MiniPill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: bg,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: "700", color }}>{label}</Text>
    </View>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: color + "12",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 9, color: color + "AA" }}>{label}</Text>
    </View>
  );
}
