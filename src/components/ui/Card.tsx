// ============================================================================
// Card — matches .glass-card / .stat-card
// ============================================================================

import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'glass' | 'stat';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const { colors: theme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: variant === 'glass' ? theme.borderLight : theme.cardBorder,
          borderRadius: variant === 'stat' ? radius['xl'] : radius['2xl'],
          padding: variant === 'stat' ? spacing[5] : spacing[6],
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: theme.shadowOpacity,
          shadowRadius: 16,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
