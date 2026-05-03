import { KeyboardAvoidingView, Platform } from "react-native";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StatusBar,
  Alert,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { GamificationToasts } from "./src/components/common/GamificationToasts";
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

// ── Error Boundary ────────────────────────────────────────────────────────
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: "#0a0a1f",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: "#ef4444",
              marginBottom: 12,
            }}
          >
            Aplikacja uległa awarii
          </Text>
          <Text style={{ fontSize: 14, color: "#f4f4f5", marginBottom: 8 }}>
            {this.state.error.message}
          </Text>
          <ScrollView
            style={{
              maxHeight: 300,
              backgroundColor: "#1a1a2e",
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Text
              selectable
              style={{
                fontSize: 10,
                color: "#a1a1aa",
                fontFamily: "monospace",
              }}
            >
              {this.state.error.stack?.slice(0, 1500)}
            </Text>
          </ScrollView>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={{
              backgroundColor: "#6366f1",
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Spróbuj ponownie
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── Nav themes ────────────────────────────────────────────────────────────
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

  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      if (event.url.includes("payment=success")) {
        await refresh();
        Alert.alert("🎉 Sukces!", "Masz teraz dostęp Premium. Miłej nauki!");
      }
    };
    const sub = Linking.addEventListener("url", handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url?.includes("payment=success")) {
        refresh().then(() =>
          Alert.alert("🎉 Sukces!", "Masz teraz dostęp Premium. Miłej nauki!"),
        );
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <NavigationContainer theme={isDark ? navDarkTheme : navLightTheme}>
        <RootNavigator />
      </NavigationContainer>
      <GamificationToasts />
    </KeyboardAvoidingView>
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
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
