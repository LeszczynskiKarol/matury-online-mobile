// ============================================================================
// Karta „Korepetycje" na Start — tylko dla ucznia powiązanego z korepetytorem
// (user.hasTutor). Na górze ekranu w OBU wariantach (FREE i Premium): uczeń
// z polecenia bez własnego zakupu ma widzieć przede wszystkim zadania od
// korepetytora, a resztę apki jako zaproszenie — tak jak na webie.
// ============================================================================

import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme";
import { getMyAssignments, type MyAssignmentsResponse } from "../../api/tutor";

export function TutorHomeCard() {
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<MyAssignmentsResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMyAssignments()
        .then((d) => alive && setData(d))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const todo = data?.assignments.filter((a) => a.status !== "DONE") ?? [];
  const tutorName = data?.tutors[0]?.displayName ?? "korepetytora";
  const noSeat = !!data && data.tutors.length > 0 && !data.seatActive && !data.ownPremium;
  const headline =
    todo.length === 0
      ? "Wszystko zrobione"
      : todo.length === 1
        ? "1 zadanie do zrobienia"
        : todo.length < 5
          ? `${todo.length} zadania do zrobienia`
          : `${todo.length} zadań do zrobienia`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate("TutorAssignments")}
      style={{
        borderRadius: radius["2xl"],
        padding: spacing[5],
        marginBottom: 20,
        backgroundColor: isDark ? colors.brand[500] + "22" : colors.brand[50],
        borderWidth: 1,
        borderColor: colors.brand[500] + (isDark ? "66" : "55"),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.brand[500],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="school" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: "DMSans_700Bold",
              color: colors.brand[600] ?? colors.brand[500],
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Korepetycje · {tutorName}
          </Text>
          <Text style={{ fontSize: 17, fontFamily: "Outfit_700Bold", color: theme.text, marginTop: 2 }}>
            {data ? headline : "Zadania od korepetytora"}
          </Text>
          {data && todo[0] && (
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {todo[0].title}
              {todo.length > 1 ? ` i ${todo.length - 1} więcej` : ""}
            </Text>
          )}
          {noSeat && (
            <Text style={{ fontSize: 12, color: colors.orange[500], marginTop: 2 }}>
              Czekasz na miejsce od korepetytora
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}
