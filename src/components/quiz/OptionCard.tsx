// ============================================================================
// OptionCard — matches .option-card / .selected / .correct / .wrong
// ============================================================================

import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';

type OptionState = 'default' | 'selected' | 'correct' | 'wrong';

interface OptionCardProps {
  id: string;
  text: string;
  state: OptionState;
  onPress: () => void;
  disabled?: boolean;
}

export function OptionCard({ id, text, state, onPress, disabled }: OptionCardProps) {
  const { colors: theme } = useTheme();

  const stateStyles: Record<OptionState, { bg: string; border: string }> = {
    default: { bg: 'transparent', border: theme.optionBorder },
    selected: { bg: theme.optionSelected, border: theme.optionSelectedBorder },
    correct: { bg: theme.optionCorrect, border: theme.optionCorrectBorder },
    wrong: { bg: theme.optionWrong, border: theme.optionWrongBorder },
  };

  const s = stateStyles[state];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[3],
        padding: spacing[4],
        borderRadius: radius['2xl'],
        borderWidth: 2,
        borderColor: s.border,
        backgroundColor: s.bg,
      }}
    >
      {/* Letter circle */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor:
            state === 'selected'
              ? theme.optionSelectedBorder
              : state === 'correct'
                ? theme.optionCorrectBorder
                : state === 'wrong'
                  ? theme.optionWrongBorder
                  : theme.inputBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Outfit_700Bold',
            color:
              state !== 'default'
                ? '#ffffff'
                : theme.textSecondary,
          }}
        >
          {id}
        </Text>
      </View>

      {/* Text */}
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontFamily: 'DMSans_400Regular',
          color: theme.text,
          lineHeight: 22,
          paddingTop: 4,
        }}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}
