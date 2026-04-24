// ============================================================================
// Quiz Result Screen — session complete
// ============================================================================

import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/common/ProgressBar";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";

export function QuizResultScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { questionsAnswered, correctAnswers, accuracy, xpEarned, totalTimeMs } =
    route.params;

  const minutes = Math.floor(totalTimeMs / 60000);
  const seconds = Math.floor((totalTimeMs % 60000) / 1000);

  const emoji =
    accuracy >= 90
      ? "🏆"
      : accuracy >= 70
        ? "🎯"
        : accuracy >= 50
          ? "💪"
          : "📚";
  const message =
    accuracy >= 90
      ? "Fantastyczny wynik!"
      : accuracy >= 70
        ? "Dobra robota!"
        : accuracy >= 50
          ? "Nieźle, ćwicz dalej!"
          : "Nie poddawaj się!";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: insets.top + 40,
        paddingHorizontal: spacing[6],
      }}
    >
      {/* Big result */}
      <View style={{ alignItems: "center", marginBottom: 40 }}>
        <Text style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</Text>
        <Text
          style={{
            fontSize: 32,
            fontFamily: "Outfit_800ExtraBold",
            color: theme.text,
            marginBottom: 4,
          }}
        >
          {accuracy}%
        </Text>
        <Text
          style={{
            fontSize: 18,
            fontFamily: "Outfit_600SemiBold",
            color: theme.textSecondary,
          }}
        >
          {message}
        </Text>
      </View>

      {/* Stats cards */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        <Card variant="stat" style={{ flex: 1, alignItems: "center" }}>
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={colors.brand[500]}
          />
          <Text
            style={{
              fontSize: 22,
              fontFamily: "Outfit_700Bold",
              color: theme.text,
              marginTop: 4,
            }}
          >
            {correctAnswers}/{questionsAnswered}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: "DMSans_400Regular",
              color: theme.textSecondary,
            }}
          >
            Poprawne
          </Text>
        </Card>
        <Card variant="stat" style={{ flex: 1, alignItems: "center" }}>
          <Ionicons name="star" size={22} color={colors.yellow[500]} />
          <Text
            style={{
              fontSize: 22,
              fontFamily: "Outfit_700Bold",
              color: theme.text,
              marginTop: 4,
            }}
          >
            +{xpEarned}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: "DMSans_400Regular",
              color: theme.textSecondary,
            }}
          >
            XP
          </Text>
        </Card>
        <Card variant="stat" style={{ flex: 1, alignItems: "center" }}>
          <Ionicons name="time" size={22} color={colors.navy[500]} />
          <Text
            style={{
              fontSize: 22,
              fontFamily: "Outfit_700Bold",
              color: theme.text,
              marginTop: 4,
            }}
          >
            {minutes > 0 ? `${minutes}m` : `${seconds}s`}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: "DMSans_400Regular",
              color: theme.textSecondary,
            }}
          >
            Czas
          </Text>
        </Card>
      </View>

      {/* Accuracy bar */}
      <Card style={{ marginBottom: 32 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_600SemiBold",
            color: theme.text,
            marginBottom: 8,
          }}
        >
          Trafność
        </Text>
        <ProgressBar
          progress={accuracy}
          height={10}
          color={
            accuracy >= 70
              ? colors.brand[500]
              : accuracy >= 50
                ? colors.orange[500]
                : colors.red[500]
          }
        />
      </Card>

      {/* Actions */}
      <View style={{ gap: 12 }}>
        <Button
          title="Nowy quiz"
          onPress={() => navigation.replace("QuizSetup")}
          icon={<Ionicons name="refresh" size={18} color="#fff" />}
        />
        <Button
          title="Wróć do panelu"
          onPress={() => navigation.getParent()?.navigate("HomeTab")}
          variant="ghost"
        />
      </View>
    </View>
  );
}
