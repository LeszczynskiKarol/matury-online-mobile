// ============================================================================
// QuestionText (mobile) — treść pytania z zachowaniem struktury tekstu
// src/components/quiz/QuestionText.tsx
//
// Logika rozpoznawania: src/lib/questionLayout.ts (ten sam plik w webach,
// apkach i backendzie). Tu tylko wygląd: kilka osób → karty z literą,
// fragment do przeczytania → karta z paskiem, reszta → CodeAwareText jak dotąd.
// ============================================================================

import React from "react";
import { View, Text } from "react-native";
import { CodeAwareText } from "../common/CodeAwareText";
import { questionLayout } from "../../lib/questionLayout";
import { parseChemText } from "../../utils/chemText";
import { colors } from "../../theme/colors";

export function QuestionText({
  text,
  theme,
  isDark,
}: {
  text: string;
  theme: any;
  isDark: boolean;
}) {
  const layout = questionLayout(text);
  const heading = {
    fontSize: 17,
    fontWeight: "500" as const,
    color: theme.text,
    lineHeight: 26,
  };
  const card = {
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.borderLight ?? theme.border,
  };
  const body = { fontSize: 15, color: theme.text, lineHeight: 23 };

  if (layout.kind === "speakers") {
    return (
      <View style={{ marginBottom: 24 }}>
        <CodeAwareText
          text={layout.intro}
          style={heading}
          containerStyle={{ marginBottom: 14 }}
          isDark={isDark}
        />
        <View style={{ gap: 10 }}>
          {layout.items.map((it, i) =>
            it.kind === "text" ? (
              <Text key={i} style={body}>
                {parseChemText(it.text)}
              </Text>
            ) : (
              <View key={i} style={[card, { flexDirection: "row", gap: 12 }]}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: colors.brand[500],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                    {it.letter}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginBottom: 4 }}>
                    {it.name}
                  </Text>
                  <Text style={body}>{parseChemText(it.body)}</Text>
                </View>
              </View>
            ),
          )}
        </View>
      </View>
    );
  }

  if (layout.kind === "passage") {
    return (
      <View style={{ marginBottom: 24 }}>
        {!!layout.before && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: theme.textSecondary,
              marginBottom: 10,
              lineHeight: 19,
            }}
          >
            {parseChemText(layout.before)}
          </Text>
        )}
        <View
          style={[
            card,
            { borderLeftWidth: 4, borderLeftColor: colors.brand[500] },
          ]}
        >
          <Text style={body}>{parseChemText(layout.passage)}</Text>
        </View>
        {!!layout.after && (
          <CodeAwareText
            text={layout.after}
            style={heading}
            containerStyle={{ marginTop: 14 }}
            isDark={isDark}
          />
        )}
      </View>
    );
  }

  return (
    <CodeAwareText
      text={layout.text}
      style={heading}
      containerStyle={{ marginBottom: 24 }}
      isDark={isDark}
    />
  );
}
