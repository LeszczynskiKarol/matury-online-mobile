// ============================================================================
// CROSS_PUNNETT — krzyżówka genetyczna (wersja mobilna)
// src/components/quiz/CrossPunnett.tsx
//
// Do 18.09.2026 ten typ nie miał w apce ŻADNEGO pola odpowiedzi — widać było
// samo polecenie, a zadania nie dało się rozwiązać (20 aktywnych pytań
// z biologii). Port z weba (BiologyQuestions.tsx → CrossPunnettQuestion),
// z tym samym kształtem odpowiedzi, którego oczekuje backend:
//   { motherGenotype, fatherGenotype, cell_<wiersz>_<kolumna>, <idPytania> }
// ============================================================================

import React from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { colors } from "../../theme/colors";
import { parseChemText } from "../../utils/chemText";

/** Dwie gamety → genotyp w notacji standardowej (dominujący przed recesywnym). */
export function combineGenotype(a: string, b: string): string {
  const groups: Record<string, string[]> = {};
  for (const ch of `${a}${b}`.split("")) {
    const key = ch.toLowerCase();
    (groups[key] ||= []).push(ch);
  }
  return Object.keys(groups)
    .sort()
    .map((k) =>
      groups[k]
        .sort((x, y) => {
          const xu = x === x.toUpperCase();
          const yu = y === y.toUpperCase();
          return xu === yu ? 0 : xu ? -1 : 1;
        })
        .join(""),
    )
    .join("");
}

const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, "").toLowerCase();

function questionOk(q: any, raw: string): boolean {
  if (Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length) {
    return q.acceptedAnswers.some((a: string) => norm(a) === norm(raw));
  }
  if (typeof q.expectedValue === "number") {
    const n = parseFloat(String(raw).replace(",", ".").replace("%", ""));
    return Number.isFinite(n) && Math.abs(n - q.expectedValue) <= (q.tolerance ?? 0);
  }
  return false;
}

export function CrossPunnett({
  content,
  values,
  onChange,
  submitted,
  theme,
}: {
  content: any;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  submitted: boolean;
  theme: any;
}) {
  const set = (k: string, v: string) => !submitted && onChange({ ...values, [k]: v });
  const motherGametes: string[] = content.motherGametes || [];
  const fatherGametes: string[] = content.fatherGametes || [];

  const field = (ok: boolean | null, correct?: string) => ({
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderColor: submitted
      ? ok
        ? colors.brand[500]
        : colors.red[500]
      : theme.border,
    color: submitted && !ok && correct ? colors.brand[600] : theme.text,
    fontWeight: submitted && !ok && correct ? ("600" as const) : undefined,
  });

  const parent = (key: "mother" | "father", icon: string) => {
    const p = content.parents?.[key];
    if (!p) return null;
    const k = `${key}Genotype`;
    const accepted: string[] = p.acceptedGenotypes || [];
    const ok = submitted && accepted.some((a) => norm(a) === norm(values[k]));
    const correct = accepted[0];
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 4 }}>
          {icon} {p.label || (key === "mother" ? "Matka" : "Ojciec")}
        </Text>
        <TextInput
          value={submitted && !ok && correct ? correct : values[k] || ""}
          onChangeText={(t) => set(k, t)}
          editable={!submitted}
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="genotyp"
          placeholderTextColor={theme.textTertiary}
          style={field(ok, correct)}
        />
      </View>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      {content.context ? (
        <View
          style={{
            backgroundColor: theme.inputBg,
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20 }}>
            {parseChemText(content.context)}
          </Text>
        </View>
      ) : null}

      {content.parents ? (
        <View style={{ flexDirection: "row", gap: 12 }}>
          {parent("mother", "♀")}
          {parent("father", "♂")}
        </View>
      ) : null}

      {content.punnettGrid && motherGametes.length > 0 && fatherGametes.length > 0 ? (
        <View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: theme.textTertiary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Tabela Punnetta
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", backgroundColor: theme.inputBg }}>
                <View style={{ width: 56, padding: 8 }} />
                {fatherGametes.map((g, ci) => (
                  <View key={ci} style={{ width: 84, padding: 8, borderLeftWidth: 1, borderColor: theme.border, alignItems: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>♂ {g}</Text>
                  </View>
                ))}
              </View>
              {motherGametes.map((mg, ri) => (
                <View key={ri} style={{ flexDirection: "row", borderTopWidth: 1, borderColor: theme.border }}>
                  <View style={{ width: 56, padding: 8, backgroundColor: theme.inputBg, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>♀ {mg}</Text>
                  </View>
                  {fatherGametes.map((fg, ci) => {
                    const cellKey = `cell_${ri}_${ci}`;
                    const correct = combineGenotype(mg, fg);
                    const ok = submitted && norm(values[cellKey]) === norm(correct);
                    return (
                      <View key={ci} style={{ width: 84, padding: 4, borderLeftWidth: 1, borderColor: theme.border }}>
                        <TextInput
                          value={submitted && !ok ? correct : values[cellKey] || ""}
                          onChangeText={(t) => set(cellKey, t)}
                          editable={!submitted}
                          autoCorrect={false}
                          autoCapitalize="none"
                          placeholder="…"
                          placeholderTextColor={theme.textTertiary}
                          style={{
                            textAlign: "center",
                            paddingVertical: 8,
                            borderRadius: 8,
                            fontSize: 14,
                            borderWidth: submitted ? 1 : 0,
                            borderColor: ok ? colors.brand[500] : colors.red[500],
                            color: submitted && !ok ? colors.brand[600] : theme.text,
                            fontWeight: submitted && !ok ? "600" : undefined,
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {(content.questions || []).map((q: any) => {
        const ok = submitted && questionOk(q, values[q.id] || "");
        const correct =
          q.acceptedAnswers?.[0] ??
          (typeof q.expectedValue === "number" ? String(q.expectedValue) : undefined);
        return (
          <View key={q.id}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: theme.text, marginBottom: 4 }}>
              {parseChemText(q.label || "")}
              {q.unit ? ` [${q.unit}]` : ""}
            </Text>
            <TextInput
              value={submitted && !ok && correct ? correct : values[q.id] || ""}
              onChangeText={(t) => set(q.id, t)}
              editable={!submitted}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Wpisz odpowiedź..."
              placeholderTextColor={theme.textTertiary}
              style={field(ok, correct)}
            />
          </View>
        );
      })}
    </View>
  );
}

export default CrossPunnett;
