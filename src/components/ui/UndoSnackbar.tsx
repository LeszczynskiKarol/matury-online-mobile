// ============================================================================
// UndoSnackbar — lekki snackbar „Wyczyszczono · Cofnij” na dole ekranu
// src/components/ui/UndoSnackbar.tsx (kopiowany 1:1 między apkami)
//
// Globalny: showUndoSnackbar() z dowolnego miejsca, <UndoSnackbarHost />
// raz w App.tsx (obok GamificationToasts). Jeden naraz — nowy zastępuje stary.
// Stoi nad klawiaturą, gdy ta jest otwarta.
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

export const UNDO_SNACKBAR_MS = 8000;

type Snack = { key: number; owner: symbol; message: string; onUndo: () => void };
type Listener = (s: Snack | null) => void;

let current: Snack | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(current));

export function showUndoSnackbar(owner: symbol, message: string, onUndo: () => void) {
  if (timer) clearTimeout(timer);
  current = { key: ++seq, owner, message, onUndo };
  timer = setTimeout(() => dismissUndoSnackbar(owner), UNDO_SNACKBAR_MS);
  emit();
}

/** Bez `owner` chowa każdy; z `owner` — tylko własny. */
export function dismissUndoSnackbar(owner?: symbol) {
  if (!current || (owner && current.owner !== owner)) return;
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
}

export function UndoSnackbarHost() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [snack, setSnack] = useState<Snack | null>(current);
  const [kb, setKb] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const l: Listener = (s) => setSnack(s);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKb(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKb(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (snack) {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }
  }, [snack?.key]);

  if (!snack) return null;
  const bg = isDark ? colors.zinc[100] : colors.zinc[900];
  const fg = isDark ? colors.zinc[900] : "#ffffff";
  const accent = isDark ? colors.brand[700] : colors.brand[300];

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: (kb > 0 ? kb : insets.bottom) + 16,
        alignItems: "center",
        zIndex: 9999,
        elevation: 30,
      }}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={{
          opacity,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: bg,
          borderRadius: 16,
          paddingLeft: 16,
          paddingRight: 4,
          minHeight: 48,
          maxWidth: "92%",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Text style={{ color: fg, fontSize: 14, fontWeight: "600" }}>
          {snack.message}
        </Text>
        <Text style={{ color: fg, opacity: 0.5, marginHorizontal: 8 }}>·</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cofnij"
          onPress={() => {
            const s = snack;
            dismissUndoSnackbar(s.owner);
            s.onUndo();
          }}
          hitSlop={8}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: 12,
            justifyContent: "center",
            borderRadius: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: accent, fontSize: 14, fontWeight: "700" }}>
            Cofnij
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
