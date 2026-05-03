// ============================================================================
// Card — matches .glass-card / .stat-card
// ============================================================================

import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { radius, spacing } from "../../theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "glass" | "stat";
}

export function Card({ children, style, variant = "default" }: CardProps) {
  const { colors: theme, isDark } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: isDark
            ? variant === "glass"
              ? theme.borderLight
              : theme.cardBorder
            : "#e4e4e7",
          borderRadius: variant === "stat" ? radius["xl"] : radius["2xl"],
          padding: variant === "stat" ? spacing[5] : spacing[6],
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: isDark ? 6 : 0 },
          shadowOpacity: isDark ? (theme.shadowOpacity as number) : 0,
          shadowRadius: isDark ? 16 : 0,
          elevation: isDark ? 3 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
