// ============================================================================
// TextWithTables — tekst (CodeAwareText: parseChemText + płoty ```kodu) z
// tabelami Markdown („| a | b |”) wyrysowanymi jako tabele.
//
// Dla pól bez odpowiednika strukturalnego — „Wzorcowa odpowiedź” arkusza
// (modelAnswer; Chemia PR, Biologia). Parser: utils/pipeTables.ts (te same
// reguły co backend services/pipe-tables.ts i web lib/pipe-tables.ts);
// blok nieregularny zostaje zwykłym tekstem. Tabela to StructTableView
// z MaterialRenderer (wygląd tabeli materiału, komórki przez parseChemText).
//
// Bez tabeli w tekście renderuje samo <CodeAwareText/> jak dotąd.
// ============================================================================

import React from "react";
import { View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import { CodeAwareText } from "./CodeAwareText";
import { StructTableView } from "../exam/MaterialRenderer";
import { splitPipeTableSegments } from "../../utils/pipeTables";

export function TextWithTables({
  text,
  style,
  theme,
  isDark,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  theme: any;
  isDark: boolean;
}) {
  const raw = typeof text === "string" ? text : "";
  const segs = splitPipeTableSegments(raw);
  if (!segs.some((s) => s.kind === "table")) {
    return <CodeAwareText text={raw} style={style} isDark={isDark} />;
  }
  return (
    <View>
      {segs.map((s, i) =>
        s.kind === "table" ? (
          <View key={i} style={{ marginVertical: 8 }}>
            <StructTableView table={s.table} theme={theme} isDark={isDark} />
          </View>
        ) : (
          <CodeAwareText key={i} text={s.text} style={style} isDark={isDark} />
        ),
      )}
    </View>
  );
}
