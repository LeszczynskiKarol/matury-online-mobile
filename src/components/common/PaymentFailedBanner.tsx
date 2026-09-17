// ============================================================================
// PaymentFailedBanner — karta „płatność za Premium nie przeszła"
// src/components/common/PaymentFailedBanner.tsx
//
// Dane przychodzą z GET /api/notifications (type PAYMENT_FAILED). Krzyżyk
// chowa kartę od razu i w tle wysyła dismiss.
//
// Apka jest dystrybuowana przez Google Play, więc nie może kierować do
// płatności poza Google Play (polityka płatności Play): żadnych linków do
// faktur Stripe, żadnego „opłać na stronie". Jedyna akcja to zakup Premium
// W APCE przez Google Play — backend po takim zakupie sam kasuje nieopłaconą
// subskrypcję Stripe (services/stripe-replace.ts). Treść jest własna, nie
// `notification.body`, bo backend pisze ją pod web („opłać albo zmień kartę").
// ============================================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import {
  dismissNotification,
  type AppNotification,
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
            Płatność za Premium nie przeszła
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              lineHeight: 19,
            }}
          >
            Dostęp Premium jest wstrzymany. Możesz kupić Premium w aplikacji
            przez Google Play — poprzednia, nieopłacona subskrypcja zostanie
            wtedy anulowana automatycznie. Postępy są zachowane.
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
        onPress={() => navigation.navigate("ProfileTab", { screen: "Subscription" })}
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
          Kup Premium w aplikacji
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
