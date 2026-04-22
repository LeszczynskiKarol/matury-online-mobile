// ============================================================================
// MATURY ONLINE — Color Tokens (1:1 with tailwind.config.mjs)
// ============================================================================

export const colors = {
  brand: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // primary accent — growth green
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  navy: {
    50: '#f0f4ff',
    100: '#e0e8ff',
    200: '#c7d4fe',
    300: '#a4b8fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#1e1b4b',
    900: '#0f0d2e',
    950: '#080720',
  },
  surface: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    700: '#1a1a2e',
    800: '#12122a',
    900: '#0a0a1f',
    950: '#050514',
  },
  zinc: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    900: '#7f1d1d',
  },
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    400: '#fb923c',
    500: '#f97316',
    700: '#c2410c',
    900: '#7c2d12',
  },
  yellow: {
    400: '#facc15',
    500: '#eab308',
  },
} as const;

// ── Light / Dark theme presets ────────────────────────────────────────────
export const lightTheme = {
  background: colors.surface[0],
  backgroundSecondary: colors.surface[50],
  card: '#ffffff',
  cardBorder: colors.zinc[200] + '80', // /50 opacity
  text: colors.zinc[900],
  textSecondary: colors.zinc[600],
  textTertiary: colors.zinc[400],
  textInverse: '#ffffff',
  primary: colors.brand[500],
  primaryLight: colors.brand[100],
  primaryText: colors.brand[700],
  secondary: colors.navy[600],
  secondaryLight: colors.navy[100],
  secondaryText: colors.navy[700],
  border: colors.zinc[200],
  borderLight: colors.zinc[200] + '80',
  inputBg: colors.zinc[50],
  tabBar: '#ffffff',
  tabBarBorder: colors.zinc[200],
  statusBar: 'dark' as const,
  // Option cards
  optionBorder: colors.zinc[200],
  optionSelected: colors.navy[50],
  optionSelectedBorder: colors.navy[400],
  optionCorrect: colors.brand[50],
  optionCorrectBorder: colors.brand[500],
  optionWrong: colors.red[50],
  optionWrongBorder: colors.red[500],
  // Badges
  xpBg: colors.brand[100],
  xpText: colors.brand[700],
  streakBg: colors.orange[100],
  streakText: colors.orange[700],
  levelBg: colors.navy[100],
  levelText: colors.navy[700],
  // Shadows
  shadowColor: '#000000',
  shadowOpacity: 0.06,
};

export const darkTheme: typeof lightTheme = {
  background: colors.surface[950],
  backgroundSecondary: colors.surface[900],
  card: colors.surface[800],
  cardBorder: colors.zinc[700] + '4D', // /30
  text: colors.zinc[100],
  textSecondary: colors.zinc[400],
  textTertiary: colors.zinc[500],
  textInverse: '#ffffff',
  primary: colors.brand[500],
  primaryLight: colors.brand[900] + '4D',
  primaryText: colors.brand[400],
  secondary: colors.navy[500],
  secondaryLight: colors.navy[800],
  secondaryText: colors.navy[300],
  border: colors.zinc[700],
  borderLight: colors.zinc[700] + '4D',
  inputBg: colors.surface[800],
  tabBar: colors.surface[900],
  tabBarBorder: colors.zinc[800],
  statusBar: 'light' as const,
  // Option cards
  optionBorder: colors.zinc[700],
  optionSelected: colors.navy[500] + '33',
  optionSelectedBorder: colors.navy[400],
  optionCorrect: colors.brand[900] + '33',
  optionCorrectBorder: colors.brand[500],
  optionWrong: colors.red[900] + '33',
  optionWrongBorder: colors.red[500],
  // Badges
  xpBg: colors.brand[900] + '4D',
  xpText: colors.brand[400],
  streakBg: colors.orange[900] + '4D',
  streakText: colors.orange[400],
  levelBg: colors.navy[800],
  levelText: colors.navy[300],
  // Shadows
  shadowColor: '#000000',
  shadowOpacity: 0.3,
};

export type ThemeColors = typeof lightTheme;
