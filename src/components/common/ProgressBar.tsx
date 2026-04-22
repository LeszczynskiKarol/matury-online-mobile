// ============================================================================
// ProgressBar — matches .progress-bar / .progress-bar-fill
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';
import { radius } from '../../theme';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  color?: string;
  animated?: boolean;
}

export function ProgressBar({
  progress,
  height = 8,
  color,
  animated = true,
}: ProgressBarProps) {
  const { colors: theme, isDark } = useTheme();
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: Math.min(100, Math.max(0, progress)),
        duration: 600,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(progress);
    }
  }, [progress]);

  const fillColor = color || colors.brand[500];

  return (
    <View
      style={{
        height,
        borderRadius: radius.full,
        backgroundColor: isDark ? colors.surface[800] : colors.zinc[100],
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: fillColor,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
