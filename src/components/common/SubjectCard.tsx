// ============================================================================
// SubjectCard — matches .subject-card
// ============================================================================

import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import { ProgressBar } from './ProgressBar';

interface SubjectCardProps {
  name: string;
  icon: string | null;
  color: string | null;
  questionsAnswered?: number;
  accuracy?: number;
  level?: number;
  onPress: () => void;
}

export function SubjectCard({
  name,
  icon,
  color,
  questionsAnswered = 0,
  accuracy = 0,
  level = 1,
  onPress,
}: SubjectCardProps) {
  const { colors: theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        borderRadius: radius['2xl'],
        padding: spacing[6],
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: theme.shadowOpacity,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      {/* Icon + Name */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.xl,
            backgroundColor: (color || '#6366f1') + '1A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22 }}>{icon || '📚'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Outfit_600SemiBold',
              color: theme.text,
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'DMSans_400Regular',
              color: theme.textSecondary,
              marginTop: 2,
            }}
          >
            Poziom {level} · {questionsAnswered} pytań
          </Text>
        </View>
      </View>

      {/* Accuracy bar */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'DMSans_500Medium',
              color: theme.textSecondary,
            }}
          >
            Trafność
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Outfit_600SemiBold',
              color: theme.primaryText,
            }}
          >
            {accuracy}%
          </Text>
        </View>
        <ProgressBar progress={accuracy} height={6} color={color || undefined} />
      </View>
    </TouchableOpacity>
  );
}
