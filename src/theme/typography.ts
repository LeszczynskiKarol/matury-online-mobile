// ============================================================================
// Typography — matches Outfit / DM Sans / JetBrains Mono from web
// ============================================================================

import { Platform } from 'react-native';

// Font family mapping — loaded via expo-font in App.tsx
export const fontFamily = {
  display: {
    light: 'Outfit_300Light',
    regular: 'Outfit_400Regular',
    medium: 'Outfit_500Medium',
    semibold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
    extrabold: 'Outfit_800ExtraBold',
    black: 'Outfit_900Black',
  },
  body: {
    regular: 'DMSans_400Regular',
    italic: 'DMSans_400Regular_Italic',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold',
  },
  mono: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
    semibold: 'JetBrainsMono_600SemiBold',
  },
} as const;

// Fallback for when fonts haven't loaded yet
export const systemFonts = {
  display: Platform.select({ ios: 'System', android: 'sans-serif-medium' })!,
  body: Platform.select({ ios: 'System', android: 'sans-serif' })!,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace' })!,
};

// Type scale
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.625,
} as const;
