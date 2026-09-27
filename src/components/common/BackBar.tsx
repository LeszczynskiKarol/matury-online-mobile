// ============================================================================
// Subtelny powrót na górze ekranu (Karol 27.09.2026)
//
// Każdy widok poza pulpitem ma drogę wstecz. W stosie — „‹ Wstecz” (goBack),
// na ekranie głównym zakładki (Quiz, Słówka, Słuchanie, Profil) — „‹ Start”,
// czyli pulpit. Mały, szary, bez tła: okruszek, nie drugi nagłówek.
// ============================================================================

import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  /** Nadpisuje domyślny napis („Wstecz” / „Start”). */
  label?: string;
  /** Nadpisuje domyślne zachowanie (goBack albo pulpit). */
  onPress?: () => void;
  /** Ekran wyniku: wróć na początek stosu (ustawienia), nie do zakończonej sesji. */
  toTop?: boolean;
}

export function BackBar({ label, onPress, toTop }: Props) {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const canGoBack = navigation.canGoBack();

  const goHome = () => {
    // Zakładki siedzą w MainNavigator — pulpit to HomeTab › Dashboard.
    let nav: any = navigation;
    while (nav && !nav.getState?.()?.routeNames?.includes("HomeTab")) nav = nav.getParent?.();
    (nav ?? navigation).navigate("HomeTab", { screen: "Dashboard" });
  };

  return (
    <TouchableOpacity
      onPress={onPress ?? (toTop && canGoBack ? () => navigation.popToTop() : canGoBack ? () => navigation.goBack() : goHome)}
      hitSlop={10}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 2, marginBottom: 10 }}
    >
      <Ionicons name="chevron-back" size={16} color={theme.textSecondary} />
      <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textSecondary }}>
        {label ?? (canGoBack ? "Wstecz" : "Start")}
      </Text>
    </TouchableOpacity>
  );
}
