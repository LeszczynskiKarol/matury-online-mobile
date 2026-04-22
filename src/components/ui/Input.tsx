// ============================================================================
// Input — matches .input from global.css
// ============================================================================

import React, { useState } from 'react';
import { TextInput, View, Text, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';
import { colors } from '../../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export function Input({ label, error, icon, isPassword, style, ...props }: InputProps) {
  const { colors: theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'DMSans_500Medium',
            color: theme.textSecondary,
            marginLeft: 4,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.inputBg,
          borderWidth: focused ? 2 : 1,
          borderColor: error
            ? colors.red[500]
            : focused
              ? colors.brand[500]
              : theme.border,
          borderRadius: radius['2xl'],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[2],
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.brand[500] : theme.textTertiary}
          />
        )}
        <TextInput
          style={[
            {
              flex: 1,
              fontSize: 14,
              fontFamily: 'DMSans_400Regular',
              color: theme.text,
              padding: 0,
            },
            style,
          ]}
          placeholderTextColor={theme.textTertiary}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'DMSans_400Regular',
            color: colors.red[500],
            marginLeft: 4,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
