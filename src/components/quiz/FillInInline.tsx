// ============================================================================
// Luki WPISYWANE W TEKŚCIE (FILL_IN) — wersja mobilna
// src/components/quiz/FillInInline.tsx
//
// Do 17.09.2026 apka pokazywała treść z wykropkowaniem, a pola do wpisania
// stały pod spodem jako „Luka 1", „Luka 2". Uczeń musiał sam pilnować, która
// kropka to które pole. Teraz pole stoi w miejscu wykropkowania.
//
// React Native nie umie wstawić pola tekstowego w środek akapitu (<Text> nie
// przyjmuje interaktywnych dzieci), więc treść jest łamana NA SŁOWA i układana
// w wierszu z zawijaniem (flexWrap). Dzięki temu pole ląduje w linii tekstu,
// a nie pod nim. Podwójna nowa linia zaczyna nowy akapit.
//
// Dopasowanie jest pozycyjne: n-ty znacznik = n-ta luka z `content.blanks`.
// Gdy liczby się nie zgadzają, wywołujący zostaje przy starym układzie —
// lepiej stara forma niż pola w losowych miejscach.
// ============================================================================

import React from "react";
import { View, Text, TextInput } from "react-native";
import { colors } from "../../theme/colors";

const MARKER_SPLIT = /(_{3,}|\.{3,}|…+)/g;
const MARKER_ONE = /^(_{3,}|\.{3,}|…+)$/;

export interface InlineBlank {
  id: string;
  acceptedAnswers?: string[];
  label?: string;
  hint?: string;
  baseWord?: string;
}

export function countBlankMarkers(text?: string | null): number {
  if (!text) return 0;
  return (text.match(MARKER_SPLIT) || []).length;
}

/** Czy da się pokazać luki w tekście (tyle znaczników, ile luk). */
export function canRenderInline(text?: string | null, blanks?: unknown): boolean {
  if (!Array.isArray(blanks) || blanks.length === 0) return false;
  return countBlankMarkers(text) === blanks.length;
}

function fieldWidth(b: InlineBlank): number {
  const longest = (b.acceptedAnswers || []).reduce(
    (m, a) => Math.max(m, a.length),
    0,
  );
  // ~8.5 px na znak przy fontSize 16, z zapasem na kursor.
  return Math.min(Math.max(longest * 8.5 + 26, 90), 220);
}

export function FillInInline({
  text,
  blanks,
  values,
  onChange,
  submitted,
  theme,
}: {
  text: string;
  blanks: InlineBlank[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  submitted: boolean;
  theme: any;
}) {
  const textStyle = {
    fontSize: 17,
    fontWeight: "500" as const,
    color: theme.text,
    lineHeight: 30,
  };

  const parts = text.split(MARKER_SPLIT);
  let blankIndex = -1;
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, pi) => {
    if (MARKER_ONE.test(part)) {
      blankIndex += 1;
      const b = blanks[blankIndex];
      if (!b) {
        nodes.push(
          <Text key={`m${pi}`} style={textStyle}>
            {part}{" "}
          </Text>,
        );
        return;
      }
      const userVal = (values[b.id] || "").trim().toLowerCase();
      const isOk =
        submitted &&
        b.acceptedAnswers?.some((a) => a.toLowerCase().trim() === userVal);
      const showCorrect = submitted && !isOk && !!b.acceptedAnswers?.[0];
      nodes.push(
        <TextInput
          key={`b${pi}`}
          value={showCorrect ? b.acceptedAnswers![0] : values[b.id] || ""}
          onChangeText={(t) => !submitted && onChange({ ...values, [b.id]: t })}
          editable={!submitted}
          placeholder={`${blankIndex + 1}.`}
          placeholderTextColor={theme.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            width: fieldWidth(b),
            marginHorizontal: 3,
            marginVertical: 2,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
            borderWidth: 1,
            fontSize: 16,
            backgroundColor: theme.inputBg,
            borderColor: submitted
              ? isOk
                ? colors.brand[500]
                : colors.red[500]
              : theme.border,
            color: showCorrect ? colors.brand[600] : theme.text,
            fontWeight: showCorrect ? "600" : "400",
          }}
        />,
      );
      return;
    }

    // Zwykły fragment: słowo po słowie, z zachowaniem nowych linii.
    const lines = part.split("\n");
    lines.forEach((line, li) => {
      if (li > 0) {
        // Nowa linia = element o pełnej szerokości; wiersz zawijany zaczyna się od nowa.
        nodes.push(<View key={`n${pi}_${li}`} style={{ width: "100%", height: 6 }} />);
      }
      line
        .split(/(\s+)/)
        .filter((w) => w.length > 0 && w.trim().length > 0)
        .forEach((word, wi) => {
          nodes.push(
            <Text key={`w${pi}_${li}_${wi}`} style={textStyle}>
              {word}{" "}
            </Text>,
          );
        });
    });
  });

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 24,
      }}
    >
      {nodes}
    </View>
  );
}

export default FillInInline;
