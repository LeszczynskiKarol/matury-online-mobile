// ============================================================================
// HScroll — poziome przewijanie tabel ze strzałkami „jest więcej obok”
// src/components/common/HScroll.tsx
//
// Szeroka tabela w ScrollView horizontal wyglądała na uciętą: pasek przewijania
// Androida pojawia się dopiero w trakcie przesuwania, więc uczeń nie wiedział,
// że kolumny ciągną się dalej (Karol 2.10.2026). Zamiennik `<ScrollView
// horizontal>`: mierzy szerokość okna i treści, a gdy treść wystaje, pokazuje
// przy krawędzi okrągły przycisk ze strzałką. Prawy, gdy jest miejsce w prawo;
// lewy, gdy jest miejsce w lewo. Klik przewija tabelę o ~3/4 szerokości okna.
// Gdy tabela się mieści, nic się nie zmienia.
//
// Przycisk ma własne, nieprzezroczyste tło (kolor marki), więc jest czytelny
// w jasnym i ciemnym motywie bez względu na kolor karty pod tabelą.
// ============================================================================

import React, { useRef, useState } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  type ScrollViewProps,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

const EDGE = 8; // px tolerancji: „prawie do końca” = koniec
const STEP = 0.75; // jaka część okna przewija się na jedno kliknięcie

export function HScroll({
  children,
  style,
  onScroll,
  onLayout,
  onContentSizeChange,
  ...rest
}: ScrollViewProps & { children?: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const [boxW, setBoxW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [x, setX] = useState(0);

  // Szerokości bierzemy też z samego zdarzenia przewijania — onContentSizeChange
  // bywa liczony przed ostatnim układem tabeli i zawyża treść o kilka px.
  const track = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const ne = e.nativeEvent;
    setX(ne.contentOffset.x);
    if (ne.contentSize?.width) setContentW(ne.contentSize.width);
    if (ne.layoutMeasurement?.width) setBoxW(ne.layoutMeasurement.width);
  };

  const maxX = Math.max(0, contentW - boxW);
  const overflow = maxX > EDGE && boxW > 0;
  const showRight = overflow && x < maxX - EDGE;
  const showLeft = overflow && x > EDGE;

  const scrollBy = (dir: 1 | -1) => {
    const next = Math.min(maxX, Math.max(0, x + dir * boxW * STEP));
    ref.current?.scrollTo({ x: next, animated: true });
    setX(next); // od razu, żeby przycisk zniknął także bez onScroll
  };

  const arrow = (dir: 1 | -1) => (
    <TouchableOpacity
      onPress={() => scrollBy(dir)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={dir === 1 ? "Przewiń tabelę w prawo" : "Przewiń tabelę w lewo"}
      style={{
        position: "absolute",
        top: 6,
        ...(dir === 1 ? { right: 6 } : { left: 6 }),
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.brand[500],
        opacity: 0.92,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 3,
      }}
    >
      <Ionicons
        name={dir === 1 ? "chevron-forward" : "chevron-back"}
        size={17}
        color="#fff"
      />
    </TouchableOpacity>
  );

  return (
    <View style={{ position: "relative" }}>
      <ScrollView
        ref={ref}
        horizontal
        style={style}
        scrollEventThrottle={32}
        onLayout={(e: LayoutChangeEvent) => {
          setBoxW(e.nativeEvent.layout.width);
          onLayout?.(e);
        }}
        onContentSizeChange={(w, h) => {
          setContentW(w);
          onContentSizeChange?.(w, h);
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          track(e);
          onScroll?.(e);
        }}
        // Android potrafi nie wysłać ostatniego onScroll po bezwładnym
        // dojechaniu do końca — wtedy strzałka zostawała na ostatniej kolumnie.
        onScrollEndDrag={track}
        onMomentumScrollEnd={track}
        {...rest}
      >
        {children}
      </ScrollView>
      {showLeft && arrow(-1)}
      {showRight && arrow(1)}
    </View>
  );
}

export default HScroll;
