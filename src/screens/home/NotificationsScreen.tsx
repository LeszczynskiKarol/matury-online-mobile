// ============================================================================
// „Powiadomienia” — lista powiadomień konta (Centrum komunikatów, 7.10.2026)
// ----------------------------------------------------------------------------
// Te same wpisy, które web pokazuje pod dzwonkiem: GET /api/notifications
// z limitem i kursorem. Tap → oznacz jako przeczytane i otwórz ekran z `url`
// (src/lib/notificationLinks). Pull-to-refresh, doładowanie na końcu listy.
// ============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { fontFamily as F } from "../../theme/typography";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListItem,
} from "../../api/notifications";
import { routeFromUrl } from "../../lib/notificationLinks";

const PAGE = 20;

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.round(h / 24);
  if (d === 1) return "wczoraj";
  if (d < 7) return `${d} dni temu`;
  return new Date(t).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
}

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (mode: "first" | "refresh") => {
    mode === "refresh" ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const page = await listNotifications({ limit: PAGE });
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
  }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listNotifications({ limit: PAGE, cursor });
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      // zostaw listę; kolejny scroll spróbuje ponownie
    } finally {
      setLoadingMore(false);
    }
  };

  const readAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    markAllNotificationsRead().catch(() => {});
  };

  const open = (n: NotificationListItem) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)));
      markNotificationRead(n.id).catch(() => {});
    }
    routeFromUrl(n.url);
  };

  const renderItem = ({ item }: { item: NotificationListItem }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => open(item)}
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: item.isRead ? theme.cardBorder : colors.brand[500] + "55",
        backgroundColor: item.isRead
          ? theme.card
          : colors.brand[500] + (isDark ? "1F" : "0F"),
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginTop: 7,
          backgroundColor: item.isRead ? "transparent" : colors.brand[500],
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: item.isRead ? F.body.semibold : F.body.bold,
            fontSize: 15,
            color: theme.text,
          }}
        >
          {item.title}
        </Text>
        {!!item.body && (
          <Text style={{ fontFamily: F.body.regular, fontSize: 14, color: theme.textSecondary, marginTop: 3, lineHeight: 20 }}>
            {item.body}
          </Text>
        )}
        <Text style={{ fontFamily: F.body.regular, fontSize: 12, color: theme.textTertiary, marginTop: 6 }}>
          {timeAgo(item.sentAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          hitSlop={10}
          style={{ paddingVertical: 6, paddingRight: 12 }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: theme.textSecondary }}>‹ Wróć</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: F.display.bold, fontSize: 20, color: theme.text }}>Powiadomienia</Text>
        {items.some((i) => !i.isRead) && (
          <TouchableOpacity
            onPress={readAll}
            hitSlop={8}
            accessibilityRole="button"
            style={{ paddingVertical: 6, paddingLeft: 8 }}
          >
            <Text style={{ fontFamily: F.body.semibold, fontSize: 13, color: colors.brand[500] }}>
              Przeczytane
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand[500]} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: insets.bottom + 90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={colors.brand[500]} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop: 8 }} color={colors.brand[500]} /> : null}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 24 }}>
              <Text style={{ fontFamily: F.body.semibold, fontSize: 15, color: theme.textSecondary, textAlign: "center" }}>
                {error
                  ? "Nie udało się wczytać powiadomień. Pociągnij w dół, żeby spróbować ponownie."
                  : "Nie masz jeszcze żadnych powiadomień."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
