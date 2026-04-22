// ============================================================================
// Button — matches .btn-primary / .btn-secondary / .btn-ghost / .btn-outline
// ============================================================================

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
}: ButtonProps) {
  const { colors: theme, isDark } = useTheme();

  const sizeStyles: Record<Size, { paddingH: number; paddingV: number; fontSize: number }> = {
    sm: { paddingH: 16, paddingV: 8, fontSize: 13 },
    md: { paddingH: 24, paddingV: 14, fontSize: 14 },
    lg: { paddingH: 32, paddingV: 16, fontSize: 16 },
  };

  const s = sizeStyles[size];

  const variantStyles: Record<Variant, { bg: ViewStyle; text: TextStyle }> = {
    primary: {
      bg: {
        backgroundColor: colors.brand[500],
        shadowColor: colors.brand[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
      },
      text: { color: '#ffffff', fontWeight: '600' },
    },
    secondary: {
      bg: {
        backgroundColor: colors.navy[600],
        shadowColor: colors.navy[600],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
      },
      text: { color: '#ffffff', fontWeight: '600' },
    },
    ghost: {
      bg: {
        backgroundColor: 'transparent',
      },
      text: { color: theme.text, fontWeight: '600' },
    },
    outline: {
      bg: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: theme.border,
      },
      text: { color: theme.text, fontWeight: '600' },
    },
  };

  const v = variantStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: s.paddingH,
          paddingVertical: s.paddingV,
          borderRadius: radius['2xl'],
          opacity: disabled ? 0.5 : 1,
        },
        v.bg,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text.color as string} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              {
                fontSize: s.fontSize,
                fontFamily: 'Outfit_600SemiBold',
              },
              v.text,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
