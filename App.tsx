// ============================================================================
// MATURY ONLINE — React Native (Expo) Entry Point
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StatusBar } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

SplashScreen.preventAutoHideAsync().catch(() => {});

const navLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#ffffff",
    card: "#ffffff",
    text: "#18181b",
    border: "#e4e4e7",
    primary: "#22c55e",
  },
};
const navDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#050514",
    card: "#0a0a1f",
    text: "#f4f4f5",
    border: "#27272a",
    primary: "#22c55e",
  },
};

function AppInner() {
  const { isDark, colors: theme } = useTheme();
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <NavigationContainer theme={isDark ? navDarkTheme : navLightTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Skip font loading for now — use system fonts
    setReady(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
