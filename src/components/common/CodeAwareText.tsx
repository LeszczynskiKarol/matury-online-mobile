// ============================================================================
// CodeAwareText — tekst, który może zawierać płoty kodu ```lang ... ```.
//
// Web renderuje płoty w ChemText jako bloki <code>; mobilny parseChemText
// zwraca goły string, więc uczeń widział dosłowne "```pseudokod" i nieczytelny
// kod (zgłoszone na egzaminie z informatyki). Fragmenty prozy przechodzą przez
// parseChemText, fragmenty kodu lądują w ciemnym monospace boxie z etykietą
// języka — lustro stylu AnalysisRenderer z Tier2TaskRenderers.
// ============================================================================

import React from "react";
import { View, Text, ScrollView } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { parseChemText } from "../../utils/chemText";

const FENCE_SPLIT = /(```[\s\S]*?```)/g;
const FENCE_PARSE = /^```([^\n`]*)\n?([\s\S]*?)```$/;

export function CodeAwareText({
  text,
  style,
  containerStyle,
  isDark,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  isDark: boolean;
}) {
  const raw = typeof text === "string" ? text : "";

  if (!raw.includes("```")) {
    return (
      <View style={containerStyle}>
        <Text style={style}>{parseChemText(raw)}</Text>
      </View>
    );
  }

  const parts = raw.split(FENCE_SPLIT);
  return (
    <View style={containerStyle}>
      {parts.map((part, i) => {
        const m = part.match(FENCE_PARSE);
        if (m) {
          const lang = (m[1] || "").trim();
          const code = m[2].replace(/\n$/, "");
          return (
            <View
              key={i}
              style={{
                backgroundColor: isDark ? "#0f172a" : "#1e293b",
                borderRadius: 12,
                padding: 12,
                marginVertical: 8,
              }}
            >
              {lang ? (
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: "#94a3b8",
                    marginBottom: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  {lang.toUpperCase()}
                </Text>
              ) : null}
              <ScrollView horizontal>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#e2e8f0",
                    fontFamily: "monospace",
                    lineHeight: 18,
                  }}
                >
                  {code}
                </Text>
              </ScrollView>
            </View>
          );
        }
        if (!part.trim()) return null;
        return (
          <Text key={i} style={style}>
            {parseChemText(part)}
          </Text>
        );
      })}
    </View>
  );
}
