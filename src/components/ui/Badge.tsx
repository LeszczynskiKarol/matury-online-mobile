// ============================================================================
// Badge — matches .xp-badge, .streak-badge, .level-badge
// ============================================================================

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius } from '../../theme';

type BadgeVariant = 'xp' | 'streak' | 'level' | 'difficulty';

interface BadgeProps {
  variant: BadgeVariant;
  value: string | number;
  icon?: string; // emoji
}

export function Badge({ variant, value, icon }: BadgeProps) {
  const { colors: theme } = useTheme();

  const styles: Record<BadgeVariant, { bg: string; text: string }> = {
    xp: { bg: theme.xpBg, text: theme.xpText },
    streak: { bg: theme.streakBg, text: theme.streakText },
    level: { bg: theme.levelBg, text: theme.levelText },
    difficulty: { bg: theme.primaryLight, text: theme.primaryText },
  };

  const s = styles[variant];

  if (variant === 'level') {
    return (
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.lg,
          backgroundColor: s.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Outfit_700Bold',
            color: s.text,
          }}
        >
          {value}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: s.bg,
      }}
    >
      {icon && <Text style={{ fontSize: 11 }}>{icon}</Text>}
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Outfit_600SemiBold',
          color: s.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
