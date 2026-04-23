// ============================================================================
// Subscription Screen — Stripe checkout via in-app browser
// Sends source:'mobile' → backend redirects to /api/stripe/mobile-return
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";

const stripeApi = {
  status: () =>
    api<{
      isPremium: boolean;
      subscriptionStatus: string;
      subscriptionEnd: string | null;
      canResume: boolean;
      canCancel: boolean;
    }>("/stripe/status"),
  checkout: (plan: "subscription" | "one_time") =>
    api<{ url: string }>("/stripe/checkout", {
      method: "POST",
      body: { plan, source: "mobile" }, // ← KEY: tells backend to use mobile-return URL
    }),
  cancel: () =>
    api<{ message: string; accessUntil: string }>("/stripe/cancel", {
      method: "POST",
    }),
  resume: () => api<{ message: string }>("/stripe/resume", { method: "POST" }),
  credits: () =>
    api<{ allowed: boolean; remaining: number; total: number }>(
      "/stripe/credits",
    ),
};

const FEATURES = [
  { icon: "📚", text: "Dostęp do wszystkich przedmiotów" },
  { icon: "♾️", text: "Nieograniczone pytania" },
  { icon: "🎯", text: "Wybór tematów i lektur" },
  { icon: "🤖", text: "AI ocena wypracowań" },
  { icon: "🔁", text: "Powtórki Spaced Repetition" },
  { icon: "📊", text: "Pełne statystyki i postępy" },
];

export function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const { isPremium, refresh } = useAuth();
  const navigation = useNavigation<any>();

  const [status, setStatus] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        stripeApi.status().catch(() => null),
        stripeApi.credits().catch(() => null),
      ]);
      setStatus(s);
      setCredits(c);
    } catch {
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    await refresh();
    setRefreshing(false);
  };

  const handleCheckout = async (plan: "subscription" | "one_time") => {
    setLoading(plan);
    try {
      const { url } = await stripeApi.checkout(plan);
      if (url) {
        // Opens Chrome Custom Tab — after payment, Stripe redirects to
        // /api/stripe/mobile-return which shows "Zamknij okno" page
        await WebBrowser.openBrowserAsync(url, {
          dismissButtonStyle: "close",
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
        // User closed the browser tab → refresh status
        await fetchStatus();
        await refresh();
        const freshStatus = await stripeApi.status().catch(() => null);
        if (freshStatus?.isPremium) {
          Alert.alert("🎉 Sukces!", "Masz teraz dostęp Premium. Miłej nauki!");
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Błąd",
        err.message || "Nie udało się utworzyć sesji płatności",
      );
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Anulować subskrypcję?",
      "Zachowasz dostęp Premium do końca opłaconego okresu.",
      [
        { text: "Zostaję z Premium 💪", style: "cancel" },
        {
          text: "Anuluj",
          style: "destructive",
          onPress: async () => {
            setLoading("cancel");
            try {
              const res = await stripeApi.cancel();
              Alert.alert(
                "Anulowano",
                `Dostęp do ${new Date(res.accessUntil).toLocaleDateString("pl")}`,
              );
              await fetchStatus();
              await refresh();
            } catch (err: any) {
              Alert.alert("Błąd", err.message);
            } finally {
              setLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleResume = async () => {
    setLoading("resume");
    try {
      await stripeApi.resume();
      Alert.alert("Wznowiono!", "Subskrypcja aktywna.");
      await fetchStatus();
      await refresh();
    } catch (err: any) {
      Alert.alert("Błąd", err.message);
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pl", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const isCancelled =
    status?.subscriptionStatus === "CANCELLED" && status?.canResume;

  if (fetching)
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
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          marginBottom: 16,
        }}
      >
        <Ionicons name="chevron-back" size={22} color={theme.text} />
        <Text style={{ fontSize: 15, fontWeight: "500", color: theme.text }}>
          Wróć
        </Text>
      </TouchableOpacity>

      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: theme.text,
          marginBottom: 24,
        }}
      >
        Subskrypcja
      </Text>

      {/* Status */}
      {status && (
        <Card style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: isPremium
                  ? colors.brand[500]
                  : colors.zinc[400],
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: theme.text }}
              >
                {isPremium ? "Premium" : "Darmowy"}
                {isCancelled ? " (anulowana)" : ""}
              </Text>
              {status.subscriptionEnd && isPremium && (
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {isCancelled ? "Wygaśnie" : "Następna płatność"}:{" "}
                  {formatDate(status.subscriptionEnd)}
                </Text>
              )}
              {!isPremium && (
                <Text
                  style={{ fontSize: 12, color: colors.red[500], marginTop: 2 }}
                >
                  Brak aktywnej subskrypcji
                </Text>
              )}
            </View>
          </View>
          {(status.canCancel || status.subscriptionStatus === "ACTIVE") && (
            <TouchableOpacity
              onPress={handleCancel}
              disabled={loading === "cancel"}
              style={{
                marginTop: 12,
                paddingVertical: 8,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: colors.red[500],
                  fontWeight: "500",
                }}
              >
                {loading === "cancel" ? "Anulowanie..." : "Anuluj subskrypcję"}
              </Text>
            </TouchableOpacity>
          )}
          {isCancelled && (
            <Button
              title={
                loading === "resume" ? "Wznawianie..." : "Wznów subskrypcję"
              }
              onPress={handleResume}
              loading={loading === "resume"}
              style={{ marginTop: 12 }}
              size="sm"
            />
          )}
        </Card>
      )}

      {/* AI Credits */}
      {isPremium && credits && (
        <Card style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: theme.text }}
            >
              Kredyty AI
            </Text>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>
              Odnowienie co miesiąc
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{ fontSize: 28, fontWeight: "800", color: theme.text }}
                >
                  {credits.remaining}
                </Text>
                <Text style={{ fontSize: 14, color: theme.textTertiary }}>
                  / {credits.total}
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.border,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    backgroundColor:
                      credits.remaining / credits.total > 0.2
                        ? colors.brand[500]
                        : colors.red[500],
                    width: `${Math.max(1, (credits.remaining / credits.total) * 100)}%`,
                  }}
                />
              </View>
            </View>
            <Text style={{ fontSize: 28 }}>
              {credits.remaining > 100
                ? "🟢"
                : credits.remaining > 0
                  ? "🟡"
                  : "🔴"}
            </Text>
          </View>
        </Card>
      )}

      {/* Pricing */}
      {(!isPremium ||
        status?.subscriptionStatus === "EXPIRED" ||
        status?.subscriptionStatus === "FREE") && (
        <View style={{ gap: 16, marginBottom: 24 }}>
          <Card style={{ borderWidth: 2, borderColor: colors.brand[500] }}>
            <View
              style={{
                position: "absolute",
                top: -12,
                left: 16,
                backgroundColor: colors.brand[500],
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 99,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
                POLECANY
              </Text>
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: theme.text,
                marginTop: 8,
              }}
            >
              Premium
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                marginBottom: 12,
              }}
            >
              Subskrypcja miesięczna
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: 4,
                marginBottom: 16,
              }}
            >
              <Text
                style={{ fontSize: 36, fontWeight: "800", color: theme.text }}
              >
                49
              </Text>
              <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                zł/mies.
              </Text>
            </View>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {FEATURES.map((f, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={{ fontSize: 14 }}>{f.icon}</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      flex: 1,
                    }}
                  >
                    {f.text}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              title={
                loading === "subscription"
                  ? "Otwieranie..."
                  : "Subskrybuj — 49 zł/mies."
              }
              onPress={() => handleCheckout("subscription")}
              loading={loading === "subscription"}
            />
            <Text
              style={{
                fontSize: 11,
                color: theme.textTertiary,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Karta / Revolut · Anuluj kiedy chcesz
            </Text>
          </Card>

          <Card>
            <Text
              style={{ fontSize: 18, fontWeight: "700", color: theme.text }}
            >
              Jednorazowy
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                marginBottom: 12,
              }}
            >
              30 dni dostępu
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: 4,
                marginBottom: 16,
              }}
            >
              <Text
                style={{ fontSize: 36, fontWeight: "800", color: theme.text }}
              >
                59
              </Text>
              <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                zł
              </Text>
            </View>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {[
                "Wszystko z Premium",
                "Bez subskrypcji",
                "Karta / Revolut / BLIK",
              ].map((t, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={{ fontSize: 12, color: colors.brand[500] }}>
                    ✓
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              title={
                loading === "one_time" ? "Otwieranie..." : "Kup dostęp — 59 zł"
              }
              onPress={() => handleCheckout("one_time")}
              loading={loading === "one_time"}
              variant="outline"
            />
          </Card>
        </View>
      )}

      {isPremium && !isCancelled && status?.subscriptionStatus === "ACTIVE" && (
        <Card
          style={{
            marginBottom: 20,
            alignItems: "center",
            paddingVertical: 24,
          }}
        >
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: theme.text,
              textAlign: "center",
            }}
          >
            Masz aktywne Premium!
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
