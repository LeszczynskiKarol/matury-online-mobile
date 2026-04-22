// ============================================================================
// MATURY ONLINE — Design System barrel
// ============================================================================

export { colors, lightTheme, darkTheme } from './colors';
export type { ThemeColors } from './colors';
export { fontFamily, systemFonts, fontSize, lineHeight } from './typography';

// Spacing scale (matches Tailwind 4px base)
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
} as const;

// Border radius — matches tailwind.config rounded
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,   // 2xl in web
  '2xl': 24, // 3xl in web
  '3xl': 32, // 4xl in web
  full: 9999,
} as const;

// Shadows
export const shadows = {
  card: {
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  cardHover: {
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 32,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    shadowOpacity: 0.3,
    elevation: 6,
  }),
} as const;
