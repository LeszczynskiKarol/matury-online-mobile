// ============================================================================
// Profile Screen — with Subscription link
// ============================================================================

import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { deleteAccount } from "../../api/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import type { ProfileStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark, toggle } = useTheme();
  const { user, isPremium, logout } = useAuth();
  const navigation = useNavigation<Nav>();
  const [credits, setCredits] = useState<{
    remaining: number;
    total: number;
  } | null>(null);
  const [buyingCredits, setBuyingCredits] = useState<string | null>(null);

  const handleLogout = () => {
    Alert.alert("Wylogować?", "Czy na pewno chcesz się wylogować?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyloguj", style: "destructive", onPress: logout },
    ]);
  };

  const statusLabel: Record<string, string> = {
    FREE: "Darmowe",
    ACTIVE: "Premium",
    ONE_TIME: "Premium (30 dni)",
    PAST_DUE: "Zaległa płatność",
    CANCELLED: "Anulowane",
    EXPIRED: "Wygasło",
  };

  useEffect(() => {
    if (isPremium) {
      api<{ remaining: number; total: number }>("/stripe/credits")
        .then(setCredits)
        .catch(() => {});
    }
  }, [isPremium]);

  const handleBuyCredits = async (pkg: string) => {
    setBuyingCredits(pkg);
    try {
      const { url } = await api<{ url: string }>("/stripe/buy-credits", {
        method: "POST",
        body: { package: pkg },
      });
      if (url) {
        await WebBrowser.openBrowserAsync(url);
        // Refresh after return
        const fresh = await api<{ remaining: number; total: number }>(
          "/stripe/credits",
        ).catch(() => null);
        if (fresh) setCredits(fresh);
      }
    } catch (err: any) {
      Alert.alert("Błąd", err.message || "Nie udało się otworzyć płatności");
    } finally {
      setBuyingCredits(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: theme.text,
          marginBottom: 24,
        }}
      >
        Profil
      </Text>

      {/* Avatar + name */}
      <Card
        style={{ marginBottom: 20, alignItems: "center", paddingVertical: 28 }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.navy[600],
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: "700", color: "#fff" }}>
            {(user?.name?.[0] || user?.email?.[0] || "M").toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text }}>
          {user?.name || "Maturzysta"}
        </Text>
        <Text
          style={{ fontSize: 14, color: theme.textSecondary, marginTop: 2 }}
        >
          {user?.email}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <Badge variant="level" value={user?.globalLevel || 1} />
          <Badge variant="xp" value={`${user?.totalXp || 0} XP`} icon="⚡" />
          <Badge variant="streak" value={`${user?.currentStreak || 0}🔥`} />
        </View>
      </Card>

      {/* Subscription card */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate("Subscription")}
      >
        <Card
          style={{
            marginBottom: 20,
            borderWidth: isPremium ? 0 : 2,
            borderColor: isPremium ? theme.cardBorder : colors.brand[500],
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.lg,
                  backgroundColor: isPremium
                    ? colors.brand[500] + "1A"
                    : colors.red[50],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={isPremium ? "diamond" : "lock-closed"}
                  size={20}
                  color={isPremium ? colors.brand[500] : colors.red[500]}
                />
              </View>
              <View>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                  Plan
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: theme.text,
                    marginTop: 1,
                  }}
                >
                  {statusLabel[user?.subscriptionStatus || "FREE"] || "Darmowe"}
                </Text>
              </View>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              {!isPremium && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.brand[500],
                  }}
                >
                  Przejdź na Premium
                </Text>
              )}
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.textTertiary}
              />
            </View>
          </View>
        </Card>
      </TouchableOpacity>

      {/* AI Credits */}
      {isPremium && credits && (
        <Card style={{ marginBottom: 20 }}>
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
              Kredyty AI
            </Text>
            <Text style={{ fontSize: 28 }}>
              {credits.remaining > 100
                ? "🟢"
                : credits.remaining > 0
                  ? "🟡"
                  : "🔴"}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 4,
              marginBottom: 8,
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
              marginBottom: 8,
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
          <Text
            style={{
              fontSize: 10,
              color: theme.textTertiary,
              marginBottom: 16,
            }}
          >
            1 kredyt ≈ $0.01 · Słuchanie ~4 kr. · Ocena AI ~1-2 kr.
          </Text>

          {/* Buy packages */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: theme.text,
              marginBottom: 10,
            }}
          >
            Dokup kredyty
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { pkg: "credits_200", amount: 200, price: "19 zł", best: false },
              { pkg: "credits_500", amount: 500, price: "39 zł", best: true },
              {
                pkg: "credits_1200",
                amount: 1200,
                price: "79 zł",
                best: false,
              },
            ].map((p) => (
              <TouchableOpacity
                key={p.pkg}
                onPress={() => handleBuyCredits(p.pkg)}
                disabled={buyingCredits !== null}
                style={{
                  flex: 1,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: radius.xl,
                  borderWidth: 2,
                  borderColor: p.best ? colors.brand[500] : theme.border,
                  backgroundColor: p.best
                    ? colors.brand[500] + "0D"
                    : "transparent",
                  opacity: buyingCredits === p.pkg ? 0.5 : 1,
                }}
              >
                {p.best && (
                  <View
                    style={{
                      position: "absolute",
                      top: -8,
                      backgroundColor: colors.brand[500],
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 99,
                    }}
                  >
                    <Text
                      style={{ fontSize: 8, fontWeight: "700", color: "#fff" }}
                    >
                      BEST
                    </Text>
                  </View>
                )}
                <Text
                  style={{ fontSize: 20, fontWeight: "800", color: theme.text }}
                >
                  {p.amount}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: theme.textTertiary,
                    marginBottom: 4,
                  }}
                >
                  kredytów
                </Text>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: theme.text }}
                >
                  {p.price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text
            style={{
              fontSize: 9,
              color: theme.textTertiary,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Kredyty nie wygasają i dodają się do puli
          </Text>
        </Card>
      )}

      {/* Settings */}
      <Card style={{ marginBottom: 20, padding: 0 }}>
        <TouchableOpacity
          onPress={toggle}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: theme.borderLight,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons
              name={isDark ? "moon" : "sunny"}
              size={20}
              color={theme.textSecondary}
            />
            <Text
              style={{ fontSize: 15, fontWeight: "500", color: theme.text }}
            >
              Tryb ciemny
            </Text>
          </View>
          <View
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              backgroundColor: isDark ? colors.brand[500] : colors.zinc[300],
              justifyContent: "center",
              paddingHorizontal: 3,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: "#fff",
                alignSelf: isDark ? "flex-end" : "flex-start",
              }}
            />
          </View>
        </TouchableOpacity>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="flame" size={20} color={colors.orange[500]} />
            <Text
              style={{ fontSize: 15, fontWeight: "500", color: theme.text }}
            >
              Najdłuższa seria
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
            {user?.longestStreak || 0} dni
          </Text>
        </View>
      </Card>

      <Button title="Wyloguj się" onPress={handleLogout} variant="ghost" />
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            "Usunąć konto?",
            "Ta operacja jest nieodwracalna. Wszystkie dane (postępy, statystyki, subskrypcja) zostaną trwale usunięte.",
            [
              { text: "Anuluj", style: "cancel" },
              {
                text: "Usuń konto",
                style: "destructive",
                onPress: () => {
                  Alert.alert(
                    "Na pewno?",
                    'Wpisz "USUŃ" mentalnie i potwierdź. Nie da się tego cofnąć.',
                    [
                      { text: "Nie, zostaję", style: "cancel" },
                      {
                        text: "Tak, usuń bezpowrotnie",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await deleteAccount();
                            logout();
                          } catch (err: any) {
                            Alert.alert(
                              "Błąd",
                              err.message || "Nie udało się usunąć konta",
                            );
                          }
                        },
                      },
                    ],
                  );
                },
              },
            ],
          );
        }}
        style={{ alignItems: "center", marginTop: 16, paddingVertical: 12 }}
      >
        <Text
          style={{ fontSize: 13, color: colors.red[500], fontWeight: "500" }}
        >
          Usuń konto
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
