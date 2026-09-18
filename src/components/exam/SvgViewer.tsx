// =============================================================================
// SvgViewer — renderuje raw SVG string przez WebView (figury geometryczne,
// materiały egzaminacyjne). Podgląd inline ma stałą wysokość; dotknięcie
// karty albo przycisku „Powiększ" otwiera pełnoekranowy ZoomableSvgModal
// z pinch-zoom / pan / double-tap (wcześniej był tylko sztywny 2× + poziomy
// scroll, bez żadnych gestów).
// =============================================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { ZoomableSvgModal } from "./ZoomableSvgModal";

/** Czy kolor tła jest ciemny — po jasności, nie po konkretnych wartościach. */
function isDarkColor(hex: unknown): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const l = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return l < 0.4;
}

export function SvgViewer({
  svg,
  theme,
  isDark: isDarkProp,
}: {
  svg: string;
  theme: any;
  /** Gdy wywołujący zna motyw (useTheme), podaje go wprost. */
  isDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const baseH = 260;
  // Do 18.09.2026 tryb ciemny rozpoznawany był po dwóch sztywno wpisanych
  // kolorach tła. Motyw apki używa innego odcienia, więc w trybie ciemnym
  // ramka i pasek podglądu wychodziły BIAŁE wokół ciemnego wykresu.
  const isDark =
    typeof isDarkProp === "boolean" ? isDarkProp : isDarkColor(theme.background);
  const bg = isDark ? "#0f0f23" : "#ffffff";

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:${bg};overflow:hidden}svg{width:100%;height:auto;max-height:100vh}</style></head><body>${svg}</body></html>`;

  return (
    <View
      style={{
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: bg,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Text style={{ fontSize: 10, color: theme.textTertiary }}>
          Dotknij, aby powiększyć
        </Text>
        <TouchableOpacity
          onPress={() => setOpen(true)}
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
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              color: theme.textTertiary,
            }}
          >
            Powiększ
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: baseH }}>
        <WebView
          originWhitelist={["*"]}
          scrollEnabled={false}
          pointerEvents="none"
          style={{ backgroundColor: "transparent", height: baseH }}
          source={{ html }}
        />
        {/* Nakładka łapie tap (otwiera modal), a przeciągnięcie oddaje
            nadrzędnemu ScrollView — WebView sam zjadałby oba gesty. */}
        <Pressable
          onPress={() => setOpen(true)}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          }}
        />
      </View>

      <ZoomableSvgModal
        visible={open}
        svg={svg}
        onClose={() => setOpen(false)}
        isDark={isDark}
      />
    </View>
  );
}
