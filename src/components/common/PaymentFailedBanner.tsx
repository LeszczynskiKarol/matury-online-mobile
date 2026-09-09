// ============================================================================
// PaymentFailedBanner — karta „płatność za Premium nie przeszła"
// src/components/common/PaymentFailedBanner.tsx
//
// Odpowiednik webowego #payment-failed-banner z layoutu Dashboard. Dane
// przychodzą z GET /api/notifications (type PAYMENT_FAILED). Krzyżyk chowa
// kartę od razu i w tle wysyła dismiss — użytkownik nie czeka na sieć.
//
// Przycisk „Opłać albo zmień kartę" otwiera Stripe hosted invoice
// (data.payUrl). To płatność za subskrypcję Stripe kupioną na webie, więc
// polityka Play nie ma tu zastosowania — subskrypcje z Play nie generują tego
// powiadomienia. Bez payUrl → ekran Subscription.
// ============================================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import {
  dismissNotification,
  type AppNotification,
  type PaymentFailedData,
} from "../../api/notifications";

export function PaymentFailedBanner({
  notification,
  onDismissed,
}: {
  notification: AppNotification;
  /** Wywoływane po lokalnym schowaniu — rodzic może wyczyścić własny stan. */
  onDismissed?: (id: string) => void;
}) {
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const data = (notification.data ?? {}) as Partial<PaymentFailedData>;
  const payUrl = typeof data.payUrl === "string" && data.payUrl ? data.payUrl : null;

  const handlePay = () => {
    if (payUrl) {
      Linking.openURL(payUrl).catch(() => {
        navigation.navigate("ProfileTab", { screen: "Subscription" });
      });
      return;
    }
    navigation.navigate("ProfileTab", { screen: "Subscription" });
  };

  const handleDismiss = () => {
    setHidden(true);
    onDismissed?.(notification.id);
    dismissNotification(notification.id).catch(() => {});
  };

  const accent = isDark ? colors.orange[400] : colors.orange[700];
  const bg = isDark ? colors.orange[900] + "2E" : colors.orange[50];
  const border = isDark ? colors.orange[700] + "80" : colors.orange[400] + "99";

  return (
    <View
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1,
        borderRadius: radius.xl,
        padding: spacing[4],
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Text style={{ fontSize: 20, lineHeight: 24 }}>💳</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: theme.text,
              lineHeight: 20,
              marginBottom: 4,
            }}
          >
            {notification.title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              lineHeight: 19,
            }}
          >
            {notification.body}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          accessibilityLabel="Zamknij"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 2 }}
        >
          <Ionicons name="close" size={20} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handlePay}
        accessibilityRole="button"
        style={{
          marginTop: 12,
          alignSelf: "flex-start",
          backgroundColor: accent,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: radius.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
          Opłać albo zmień kartę
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
