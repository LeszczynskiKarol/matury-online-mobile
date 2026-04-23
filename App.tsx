import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StatusBar, Alert } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";

import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/colors";

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
  const { isLoading, refresh } = useAuth();

  // Handle deep link payment callbacks
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const { url } = event;
      if (url.includes("payment=success")) {
        await refresh();
        Alert.alert("🎉 Sukces!", "Masz teraz dostęp Premium. Miłej nauki!");
      }
    };

    const sub = Linking.addEventListener("url", handleUrl);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url?.includes("payment=success")) {
        refresh().then(() => {
          Alert.alert("🎉 Sukces!", "Masz teraz dostęp Premium. Miłej nauki!");
        });
      }
    });

    return () => sub.remove();
  }, [refresh]);

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
        <ActivityIndicator size="large" color={colors.brand[500]} />
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
