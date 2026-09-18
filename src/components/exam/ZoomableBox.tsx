// =============================================================================
// ZoomableBox — pełnoekranowe powiększanie DOWOLNEGO materiału (nie tylko SVG)
// src/components/exam/ZoomableBox.tsx
//
// Do 18.09.2026 powiększać dało się wyłącznie materiały będące tekstem SVG
// (SvgViewer → ZoomableSvgModal w WebView). Wykresy, klimatogramy, mapy Polski,
// drzewa genealogiczne i obrazy rysowane natywnie (react-native-svg / Image)
// nie miały ŻADNEGO powiększania — na telefonie oznaczało to odczytywanie
// wartości z wykresu szerokości ~300 px (zgłoszone przy arkuszach geografii).
//
// Gesty są na czystym PanResponder + Animated, bez nowych zależności
// natywnych: szczypanie (2 palce), przesuwanie (1 palec), podwójne stuknięcie
// przełącza 1× ↔ 2,5×. Modal leży poza ScrollView arkusza, więc nic nie
// konkuruje o gesty.
// =============================================================================

import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_SCALE = 5;
const MIN_SCALE = 1;

function touchDistance(t: readonly { pageX: number; pageY: number }[]): number {
  return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) || 1;
}

function ZoomStage({
  children,
  bg,
  contentWidth,
}: {
  children: React.ReactNode;
  bg: string;
  contentWidth?: number;
}) {
  const { width: vw, height: vh } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  // Stan gestu trzymamy w refach — PanResponder tworzony jest raz.
  const s = useRef({ k: 1, x: 0, y: 0, k0: 1, x0: 0, y0: 0, d0: 1, pinch: false, moved: false, lastTap: 0 }).current;
  const size = useRef({ w: vw, h: vh * 0.5 }).current;
  // Zmierzone wymiary sceny i treści — z nich liczymy położenie „na środku".
  const [box, setBox] = useState({ W: 0, H: 0, w: 0, h: 0 });

  const apply = (k: number, x: number, y: number, animated = false) => {
    const kk = Math.max(MIN_SCALE, Math.min(MAX_SCALE, k));
    // Treść nie może uciec poza ekran dalej, niż pozwala jej powiększony rozmiar.
    const maxX = Math.max(0, (size.w * kk - vw) / 2 + 24);
    const maxY = Math.max(0, (size.h * kk - vh) / 2 + 24);
    const xx = Math.max(-maxX, Math.min(maxX, x));
    const yy = Math.max(-maxY, Math.min(maxY, y));
    s.k = kk; s.x = xx; s.y = yy;
    if (animated) {
      Animated.parallel([
        Animated.timing(scale, { toValue: kk, duration: 160, useNativeDriver: true }),
        Animated.timing(tx, { toValue: xx, duration: 160, useNativeDriver: true }),
        Animated.timing(ty, { toValue: yy, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(kk); tx.setValue(xx); ty.setValue(yy);
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const t = e.nativeEvent.touches;
          s.moved = false;
          s.pinch = t.length >= 2;
          s.k0 = s.k; s.x0 = s.x; s.y0 = s.y;
          if (s.pinch) s.d0 = touchDistance(t);
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          if (t.length >= 2) {
            if (!s.pinch) {
              // Drugi palec doszedł w trakcie przesuwania — startujemy szczypanie od teraz.
              s.pinch = true; s.d0 = touchDistance(t); s.k0 = s.k; s.x0 = s.x; s.y0 = s.y;
            }
            s.moved = true;
            apply(s.k0 * (touchDistance(t) / s.d0), s.x0, s.y0);
          } else if (!s.pinch) {
            if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) s.moved = true;
            apply(s.k, s.x0 + g.dx, s.y0 + g.dy);
          }
        },
        onPanResponderRelease: () => {
          if (!s.moved && !s.pinch) {
            const now = Date.now();
            if (now - s.lastTap < 300) {
              apply(s.k > 1.05 ? 1 : 2.5, 0, 0, true);
              s.lastTap = 0;
            } else {
              s.lastTap = now;
            }
          }
          s.pinch = false;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vw, vh],
  );

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => {
        const { width: W, height: H } = e.nativeEvent.layout;
        setBox((b) => (b.W === W && b.H === H ? b : { ...b, W, H }));
      }}
      style={{ flex: 1, backgroundColor: bg, overflow: "hidden" }}
    >
      <Animated.View
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          size.w = w;
          size.h = h;
          setBox((b) => (b.w === w && b.h === h ? b : { ...b, w, h }));
        }}
        // Treść nie łapie dotyku — cały ekran jest powierzchnią gestów.
        pointerEvents="none"
        // Pozycja absolutna + środek liczony z pomiaru, a nie justifyContent:
        // element absolutny dostaje swoją NATURALNĄ wysokość. Jako zwykłe
        // dziecko flexa wykres z poziomym ScrollView rozciągał się na całe
        // okno i rysunek lądował u góry, pod tytułem i „Zamknij".
        style={{
          position: "absolute",
          left: Math.max(0, (box.W - box.w) / 2),
          top: (box.H - box.h) / 2,
          width: contentWidth ? Math.min(contentWidth, vw) : undefined,
          opacity: box.H > 0 && box.h > 0 ? 1 : 0,
          transform: [{ translateX: tx }, { translateY: ty }, { scale }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export function ZoomableBox({
  children,
  theme,
  isDark,
  title,
}: {
  children: React.ReactNode;
  theme: any;
  isDark: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inlineW, setInlineW] = useState(0);
  const insets = useSafeAreaInsets();
  const bg = isDark ? "#0f0f23" : "#ffffff";

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <Text style={{ fontSize: 10, color: theme.textTertiary }}>
          Dotknij, aby powiększyć
        </Text>
        <TouchableOpacity
          onPress={() => setOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            backgroundColor: theme.inputBg,
          }}
        >
          <Text style={{ fontSize: 12 }}>🔎</Text>
          <Text style={{ fontSize: 10, fontWeight: "600", color: theme.textTertiary }}>
            Powiększ
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stuknięcie w sam materiał też otwiera powiększenie. Przesunięcie palcem
          zostaje przy nadrzędnym ScrollView (Pressable nie zabiera przewijania). */}
      <Pressable onPress={() => setOpen(true)}>
        <View
          pointerEvents="none"
          onLayout={(e) => setInlineW(Math.round(e.nativeEvent.layout.width))}
        >
          {children}
        </View>
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        hardwareAccelerated
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={bg} />
        <View style={{ flex: 1, backgroundColor: bg }}>
          {open && (
            <ZoomStage bg={bg} contentWidth={inlineW || undefined}>
              {children}
            </ZoomStage>
          )}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 12,
              right: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 12, color: isDark ? "#a1a1aa" : "#71717a", marginRight: 12 }}
            >
              {title || "Szczypnij, aby powiększyć · stuknij 2×, aby przełączyć"}
            </Text>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: isDark ? "#27272a" : "#f4f4f5",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#fafafa" : "#18181b" }}>
                Zamknij ✕
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default ZoomableBox;
