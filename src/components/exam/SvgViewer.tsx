// =============================================================================
// SvgViewer — renderuje raw SVG string przez WebView (figury geometryczne)
// Wyciągnięte z QuizPlayScreen żeby reuse w ExamPlayerScreen.
// =============================================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { WebView } from "react-native-webview";

const SCREEN_WIDTH = Dimensions.get("window").width;

export function SvgViewer({ svg, theme }: { svg: string; theme: any }) {
  const [zoomed, setZoomed] = useState(false);
  const baseH = 260;
  const h = zoomed ? baseH * 2 : baseH;
  const bg =
    theme.background === "#0a0a1a" || theme.background === "#0f0f23"
      ? "#0f0f23"
      : "#ffffff";

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:${bg};overflow:hidden}svg{width:100%;height:auto;max-height:100vh}</style></head><body>${svg}</body></html>`;

  const webview = (
    <WebView
      originWhitelist={["*"]}
      scrollEnabled={false}
      style={{
        backgroundColor: "transparent",
        height: h,
        width: zoomed ? SCREEN_WIDTH * 2 : undefined,
      }}
      source={{ html }}
    />
  );

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
          justifyContent: "flex-end",
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => setZoomed(!zoomed)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            backgroundColor: zoomed ? "rgba(99,102,241,0.2)" : theme.inputBg,
          }}
        >
          <Text style={{ fontSize: 12 }}>{zoomed ? "🔍" : "🔎"}</Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              color: zoomed ? "#6366f1" : theme.textTertiary,
            }}
          >
            {zoomed ? "Zmniejsz" : "Powiększ"}
          </Text>
        </TouchableOpacity>
      </View>

      {zoomed ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width: SCREEN_WIDTH * 2, height: h }}>{webview}</View>
        </ScrollView>
      ) : (
        <View style={{ height: baseH }}>{webview}</View>
      )}
    </View>
  );
}
