// ============================================================================
// Theme Context — dark / light mode (matches web dark:class)
// ============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { lightTheme, darkTheme, type ThemeColors } from "../theme/colors";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Wybór z Profilu („Tryb ciemny”) przeżywa restart apki (7.10.2026).
const STORE_KEY = "theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    SecureStore.setItemAsync(STORE_KEY, m).catch(() => {});
  };

  const isDark = useMemo(() => {
    if (mode === "system") return systemScheme === "dark";
    return mode === "dark";
  }, [mode, systemScheme]);

  const colors = (isDark ? darkTheme : lightTheme) as ThemeColors;

  const toggle = () => setMode(isDark ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
