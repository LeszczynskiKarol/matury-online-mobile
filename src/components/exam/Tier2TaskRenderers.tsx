// =============================================================================
// Tier2TaskRenderers.tsx — specjalistyczne renderery
// sequence, cross_punnett, scheme_fill, fill_choose, info_* (code), table_fill,
// identify_persons
// =============================================================================

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { ClearableTextInput } from "../ui/ClearAnswerButton";
import { withSymbols } from "./SymbolPalette";

// Małe pola (Punnett, schematy, tabele, arkusz, krótkie odpowiedzi): pasek
// „∑ Symbole” z SymbolScope w ExamPlayerScreen. Edytory kodu zostają bez.
const SymTextInput = withSymbols(TextInput);
const SymClearableTextInput = withSymbols(ClearableTextInput);

import { HScroll } from "../common/HScroll";
interface RenderProps {
  task: any;
  value: any;
  onChange: (v: any) => void;
  theme: any;
  isDark: boolean;
}

// Lista typów które ten plik obsługuje (rozpoznawane po sufiksie po prefiksie subject)
const TIER2_SUFFIXES = new Set([
  "sequence",
  "cross_punnett",
  "scheme_fill",
  "fill_choose",
  "algorithm",
  "programming",
  "sql",
  "spreadsheet",
  "analysis",
  "table_fill",
  "fill_table",
  "identify_persons",
  // Historia/WOS — specjalne UI
  "essay_5pt",
  "essay_7pt",
  "essay_10pt",
  "essay_15pt",
  "decide_justify",
  "style_recognition",
]);

const SUBJECT_PREFIX_RE = /^(hist|bio|chem|phys|geo|wos|info)_/;

export function isTier2TaskType(type: string): boolean {
  const m = type.match(SUBJECT_PREFIX_RE);
  if (!m) return false;
  const suffix = type.slice(m[0].length);
  return TIER2_SUFFIXES.has(suffix);
}

function getSuffix(type: string): string {
  const m = type.match(SUBJECT_PREFIX_RE);
  return m ? type.slice(m[0].length) : type;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENCE — uporządkuj elementy (przyciski ↑/↓ zamiast drag&drop)
// ─────────────────────────────────────────────────────────────────────────────

function SequenceRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const items = task.content?.items || task.content?.elements || [];
  // Stan: lista id w obecnej kolejności użytkownika.
  const initialOrder = Array.isArray(value) && value.length === items.length
    ? value
    : items.map((it: any) => it.id);
  const order: string[] = initialOrder;

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    const next = [...order];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  };

  return (
    <View>
      <Text
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: theme.textSecondary,
          marginBottom: 12,
        }}
      >
        Użyj przycisków ↑ ↓ aby ustawić elementy w prawidłowej kolejności.
      </Text>
      <View style={{ gap: 8 }}>
        {order.map((id, idx) => {
          const item = items.find((it: any) => it.id === id);
          if (!item) return null;
          return (
            <View
              key={id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: colors.brand[500],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
                  {idx + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}
                >
                  <Text style={{ fontWeight: "700" }}>{id}. </Text>
                  {item.text}
                </Text>
              </View>
              <View style={{ gap: 4 }}>
                <TouchableOpacity
                  onPress={() => move(idx, -1)}
                  disabled={idx === 0}
                  style={{
                    width: 32,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: idx === 0 ? theme.inputBg : theme.border,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: idx === 0 ? 0.3 : 1,
                  }}
                >
                  <Ionicons name="chevron-up" size={16} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => move(idx, 1)}
                  disabled={idx === order.length - 1}
                  style={{
                    width: 32,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor:
                      idx === order.length - 1 ? theme.inputBg : theme.border,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: idx === order.length - 1 ? 0.3 : 1,
                  }}
                >
                  <Ionicons name="chevron-down" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUNNETT — krzyżówka genetyczna: genotypy rodziców + szachownica n×m +
// fenotypy + prawdopodobieństwo.
//
// Szachownica ma tyle wierszy/kolumn, ile gamet ustali uczeń (2×2 przy jednym
// genie, 4×4 przy dwóch, 4×2 przy AaBb × Aabb…); nagłówki są edytowalne, bo
// wyznaczenie gamet jest częścią zadania. Genotypów rodziców, szukanego
// fenotypu i prawdopodobieństwa NIE pokazujemy — to odpowiedź (API wycina je
// z /start). Wyjątek: `content.givenParents === true`.
// Kształt odpowiedzi (wspólny z webem): backend/src/services/punnett-response.ts
// — { genotypes, motherGametes[], fatherGametes[], grid[][], cross,
//     phenotypes, probability }. Stary kształt apki (motherGenotype,
//     fatherGenotype, gridCells{"r_c"}, targetProbability) jest czytany
//     przy wznowieniu podejścia i przepisywany przy pierwszej edycji.
// ─────────────────────────────────────────────────────────────────────────────

const PUNNETT_MIN = 1;
const PUNNETT_MAX = 8;

type PunnettValue = {
  genotypes?: string;
  motherGametes?: string[];
  fatherGametes?: string[];
  grid?: string[][];
  cross?: string;
  phenotypes?: string;
  probability?: string;
};

const fitArray = (a: string[] | undefined, n: number) =>
  Array.from({ length: n }, (_, i) => (a && typeof a[i] === "string" ? a[i] : ""));
const fitGrid = (g: string[][] | undefined, rows: number, cols: number) =>
  Array.from({ length: rows }, (_, r) => fitArray(g?.[r], cols));
const clampPunnett = (n: number) =>
  Math.min(PUNNETT_MAX, Math.max(PUNNETT_MIN, Math.round(n) || 2));
const splitGametes = (s: unknown) =>
  typeof s === "string" ? s.split(/[\s,;]+/).filter(Boolean) : [];

/** Odpowiedź w nowym kształcie; stary kształt apki przepisany. */
export function normalizePunnettValue(value: any): PunnettValue {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  if (!("gridCells" in v) && !("motherGenotype" in v) && !("targetProbability" in v)) return v;
  const mother = Array.isArray(v.motherGametes) ? v.motherGametes : splitGametes(v.motherGenotype);
  const father = Array.isArray(v.fatherGametes) ? v.fatherGametes : splitGametes(v.fatherGenotype);
  const rows = clampPunnett(mother.length || 2);
  const cols = clampPunnett(father.length || 2);
  const cells = v.gridCells && typeof v.gridCells === "object" ? v.gridCells : {};
  return {
    genotypes: v.genotypes,
    motherGametes: fitArray(mother, rows),
    fatherGametes: fitArray(father, cols),
    grid: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => String(cells[`${r}_${c}`] ?? "")),
    ),
    cross: v.cross,
    phenotypes: v.phenotypes,
    probability: v.probability ?? v.targetProbability,
  };
}

function PunnettStepper({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  theme: any;
}) {
  const btn = (disabled: boolean) => ({
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: disabled ? 0.35 : 1,
  });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: 12, color: theme.textSecondary }}>{label}</Text>
      <TouchableOpacity
        disabled={value <= PUNNETT_MIN}
        onPress={() => onChange(value - 1)}
        style={btn(value <= PUNNETT_MIN)}
        accessibilityLabel={`${label}: mniej`}
      >
        <Ionicons name="remove" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ width: 16, textAlign: "center", fontWeight: "800", color: theme.text }}>
        {value}
      </Text>
      <TouchableOpacity
        disabled={value >= PUNNETT_MAX}
        onPress={() => onChange(value + 1)}
        style={btn(value >= PUNNETT_MAX)}
        accessibilityLabel={`${label}: więcej`}
      >
        <Ionicons name="add" size={16} color={theme.text} />
      </TouchableOpacity>
    </View>
  );
}

function PunnettRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const current = normalizePunnettValue(value);
  const alleleNotation = typeof c.alleleNotation === "string" ? c.alleleNotation : "";
  const given = c.givenParents === true ? c.parentGenotypes : null;

  // Rozmiar zmieniony przed wpisaniem czegokolwiek zostaje lokalnie — pusta
  // szachownica nie może liczyć się jako odpowiedź.
  const [localSize, setLocalSize] = React.useState<[number, number]>(() => [
    clampPunnett(Number(c.gridSize?.rows) || 2),
    clampPunnett(Number(c.gridSize?.cols) || 2),
  ]);
  const rows = current.motherGametes?.length
    ? clampPunnett(current.motherGametes.length)
    : localSize[0];
  const cols = current.fatherGametes?.length
    ? clampPunnett(current.fatherGametes.length)
    : localSize[1];
  const mother = fitArray(current.motherGametes, rows);
  const father = fitArray(current.fatherGametes, cols);
  const grid = fitGrid(current.grid, rows, cols);

  const update = (patch: Partial<PunnettValue>) =>
    onChange({
      genotypes: current.genotypes ?? "",
      cross: current.cross ?? "",
      phenotypes: current.phenotypes ?? "",
      probability: current.probability ?? "",
      motherGametes: mother,
      fatherGametes: father,
      grid,
      ...patch,
    });
  const hasText = [...mother, ...father, ...grid.flat()].some((x) => x.trim());
  const resize = (r: number, col: number) => {
    setLocalSize([r, col]);
    if (hasText || current.motherGametes?.length)
      update({
        motherGametes: fitArray(mother, r),
        fatherGametes: fitArray(father, col),
        grid: fitGrid(grid, r, col),
      });
  };

  const label = {
    fontSize: 11,
    fontWeight: "700" as const,
    color: theme.textTertiary,
    marginBottom: 4,
  };
  const field = {
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.text,
  };
  const CELL_W = 72;
  const cellBase = {
    width: CELL_W,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
    textAlign: "center" as const,
    fontSize: 14,
    color: theme.text,
    fontFamily: "monospace",
    backgroundColor: theme.inputBg,
  };
  const headCell = {
    ...cellBase,
    borderWidth: 2,
    borderColor: colors.brand[500],
    fontWeight: "800" as const,
  };
  const bodyCell = { ...cellBase, borderWidth: 1, borderColor: theme.border, fontWeight: "600" as const };
  const noAuto = {
    autoComplete: "off" as const,
    importantForAutofill: "no" as const,
    textContentType: "none" as const,
    autoCorrect: false,
    spellCheck: false,
    autoCapitalize: "none" as const,
  };

  return (
    <View style={{ gap: 14 }}>
      {(given?.mother || given?.father || alleleNotation) ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "#15803d20" : "#ecfdf5",
            borderWidth: 1,
            borderColor: isDark ? "#15803d40" : "#a7f3d0",
            gap: 2,
          }}
        >
          {given?.mother ? (
            <Text style={{ fontSize: 12, fontWeight: "700", color: theme.text }}>
              Genotyp matki (podany): <Text style={{ fontWeight: "800" }}>{String(given.mother)}</Text>
            </Text>
          ) : null}
          {given?.father ? (
            <Text style={{ fontSize: 12, fontWeight: "700", color: theme.text }}>
              Genotyp ojca (podany): <Text style={{ fontWeight: "800" }}>{String(given.father)}</Text>
            </Text>
          ) : null}
          {alleleNotation ? (
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>
              Oznaczenia alleli: {alleleNotation}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View>
        <Text style={label}>GENOTYPY RODZICÓW</Text>
        <SymClearableTextInput
          {...noAuto}
          value={current.genotypes ?? ""}
          onChangeText={(t) => update({ genotypes: t })}
          placeholder="np. matka: Aa, ojciec: aa"
          placeholderTextColor={theme.textTertiary}
          style={field}
        />
      </View>

      <View>
        <Text style={label}>SZACHOWNICA PUNNETTA</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
          <PunnettStepper label="Gamety w wierszach" value={rows} onChange={(n) => resize(n, cols)} theme={theme} />
          <PunnettStepper label="w kolumnach" value={cols} onChange={(n) => resize(rows, n)} theme={theme} />
        </View>
        <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6, lineHeight: 16 }}>
          W obramowanych polach wpisz gamety rodziców (wiersze — jeden rodzic,
          kolumny — drugi), w pozostałych genotypy potomstwa.
        </Text>
        <HScroll showsHorizontalScrollIndicator={cols > 3}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={{ width: CELL_W, justifyContent: "center" }}>
                <Text style={{ fontSize: 10, color: theme.textTertiary, textAlign: "center" }}>gamety</Text>
              </View>
              {father.map((g, ci) => (
                <SymTextInput
                  key={`f${ci}`}
                  {...noAuto}
                  value={g}
                  onChangeText={(t) => update({ fatherGametes: father.map((x, i) => (i === ci ? t : x)) })}
                  placeholder="gameta"
                  placeholderTextColor={theme.textTertiary}
                  accessibilityLabel={`Gameta w kolumnie ${ci + 1}`}
                  style={headCell}
                />
              ))}
            </View>
            {grid.map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row", gap: 6 }}>
                <SymTextInput
                  {...noAuto}
                  value={mother[ri]}
                  onChangeText={(t) => update({ motherGametes: mother.map((x, i) => (i === ri ? t : x)) })}
                  placeholder="gameta"
                  placeholderTextColor={theme.textTertiary}
                  accessibilityLabel={`Gameta w wierszu ${ri + 1}`}
                  style={headCell}
                />
                {row.map((cell, ci) => (
                  <SymTextInput
                    key={ci}
                    {...noAuto}
                    value={cell}
                    onChangeText={(t) =>
                      update({
                        grid: grid.map((r2, i) => (i === ri ? r2.map((x, j) => (j === ci ? t : x)) : r2)),
                      })
                    }
                    placeholder="—"
                    placeholderTextColor={theme.textTertiary}
                    accessibilityLabel={`Genotyp potomstwa: wiersz ${ri + 1}, kolumna ${ci + 1}`}
                    style={bodyCell}
                  />
                ))}
              </View>
            ))}
          </View>
        </HScroll>
      </View>

      <View>
        <Text style={label}>INNY ZAPIS KRZYŻÓWKI (OPCJONALNIE)</Text>
        <SymClearableTextInput
          {...noAuto}
          value={current.cross ?? ""}
          onChangeText={(t) => update({ cross: t })}
          placeholder="np. druga krzyżówka (AB0 i Rh osobno), geny sprzężone"
          placeholderTextColor={theme.textTertiary}
          multiline
          style={{ ...field, minHeight: 64, textAlignVertical: "top", fontFamily: "monospace" }}
        />
      </View>

      <View>
        <Text style={label}>FENOTYPY POTOMSTWA</Text>
        <SymClearableTextInput
          {...noAuto}
          value={current.phenotypes ?? ""}
          onChangeText={(t) => update({ phenotypes: t })}
          placeholder="np. 3 szare : 1 białe"
          placeholderTextColor={theme.textTertiary}
          style={field}
        />
      </View>

      <View>
        <Text style={label}>PRAWDOPODOBIEŃSTWO</Text>
        <SymClearableTextInput
          {...noAuto}
          value={current.probability ?? ""}
          onChangeText={(t) => update({ probability: t })}
          placeholder="ułamek lub procent"
          placeholderTextColor={theme.textTertiary}
          keyboardType="numbers-and-punctuation"
          style={field}
        />
      </View>
    </View>
  );
}

/** Czy odpowiedź ma kształt krzyżówki? Zadanie mogło zmienić typ po jej
 *  zapisaniu (Biologia PR #30 zad. 33: bio_cross_punnett → bio_open_extended). */
export function looksLikePunnettResponse(r: any): boolean {
  if (!r || typeof r !== "object" || Array.isArray(r)) return false;
  const k = Object.keys(r);
  return (
    k.some((x) => ["grid", "gridCells", "motherGametes", "fatherGametes", "motherGenotype", "fatherGenotype"].includes(x)) ||
    (k.includes("genotypes") && k.some((x) => ["cross", "phenotypes", "probability"].includes(x)))
  );
}

/** Widok wyniku: odpowiedź ucznia z szachownicą (nowy i stary kształt). */
export function PunnettResponseView({ response, theme }: { response: any; theme: any }) {
  const v = normalizePunnettValue(response);
  const mother = v.motherGametes ?? [];
  const father = v.fatherGametes ?? [];
  const grid = v.grid ?? [];
  const hasGrid = [...mother, ...father, ...grid.flat()].some((x) => typeof x === "string" && x.trim());
  const box = {
    backgroundColor: theme.inputBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 4,
  };
  const cap = { fontSize: 11, fontWeight: "700" as const, color: theme.textTertiary };
  const txt = { fontSize: 13, color: theme.text, lineHeight: 19 };
  const cell = (head: boolean) => ({
    minWidth: 56,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: head ? colors.brand[500] : theme.border,
    textAlign: "center" as const,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: head ? ("800" as const) : ("600" as const),
    color: theme.text,
  });
  const rowsOut: { label: string; value?: string }[] = [
    { label: "Genotypy rodziców", value: v.genotypes },
    { label: "Inny zapis krzyżówki", value: v.cross },
    { label: "Fenotypy", value: v.phenotypes },
    { label: "Prawdopodobieństwo", value: v.probability },
  ].filter((x) => typeof x.value === "string" && x.value.trim());
  if (!hasGrid && rowsOut.length === 0)
    return (
      <View style={box}>
        <Text style={{ ...txt, color: theme.textTertiary }}>Brak odpowiedzi</Text>
      </View>
    );
  return (
    <View style={box}>
      {rowsOut.filter((x) => x.label === "Genotypy rodziców").map((x) => (
        <Text key={x.label} style={txt}>
          <Text style={cap}>{x.label}: </Text>
          {x.value}
        </Text>
      ))}
      {hasGrid ? (
        <HScroll style={{ marginVertical: 6 }}>
          <View>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ ...cell(false), borderColor: "transparent", color: theme.textTertiary, fontSize: 10 }}>
                gamety
              </Text>
              {father.map((g, i) => (
                <Text key={i} style={cell(true)}>{g || "—"}</Text>
              ))}
            </View>
            {grid.map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row" }}>
                <Text style={cell(true)}>{mother[ri] || "—"}</Text>
                {row.map((x, ci) => (
                  <Text key={ci} style={cell(false)}>{x || "—"}</Text>
                ))}
              </View>
            ))}
          </View>
        </HScroll>
      ) : null}
      {rowsOut.filter((x) => x.label !== "Genotypy rodziców").map((x) => (
        <Text key={x.label} style={txt}>
          <Text style={cap}>{x.label}: </Text>
          {x.value}
        </Text>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEME_FILL — schemat reakcji z lukami
// ─────────────────────────────────────────────────────────────────────────────

function SchemeFillRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const blanks = task.content?.blanks || [];
  const ans =
    typeof value === "object" && value && !Array.isArray(value) ? value : {};

  if (blanks.length === 0) {
    return (
      <SymClearableTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
        value={typeof value === "string" ? value : ""}
        onChangeText={onChange}
        placeholder="Napisz schemat reakcji..."
        placeholderTextColor={theme.textTertiary}
        multiline
        style={{
          backgroundColor: theme.inputBg,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
          color: theme.text,
          minHeight: 160,
          fontFamily: "monospace",
          textAlignVertical: "top",
        }}
      />
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {blanks.map((b: any) => (
        <View key={b.id}>
          {b.label || b.prompt ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: theme.text,
                marginBottom: 4,
              }}
            >
              {b.label || b.prompt}
            </Text>
          ) : null}
          <SymTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
            value={ans[b.id] || ""}
            onChangeText={(t) => onChange({ ...ans, [b.id]: t })}
            placeholder={b.placeholder || "Wpisz..."}
            placeholderTextColor={theme.textTertiary}
            autoCorrect={false}
            style={{
              backgroundColor: theme.inputBg,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              color: theme.text,
              fontFamily: "monospace",
            }}
          />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILL_CHOOSE — sentence completion z dropdown (nawiasy: "(opcja1 / opcja2)")
// ─────────────────────────────────────────────────────────────────────────────

function FillChooseRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const sentences: any[] = Array.isArray(c.sentences) ? c.sentences : [];
  const blanksAlt: any[] = Array.isArray(c.blanks) ? c.blanks : [];

  const ans =
    typeof value === "object" && value && !Array.isArray(value) ? value : {};

  // Parser: znajduje (opcja1 / opcja2 / …) i renderuje jako buttony
  const parseSentence = (text: string, key: string) => {
    const parts = text.split(/\(([^)]+)\)/g);
    return parts.map((part, i) => {
      // Co drugi (i % 2 === 1) to grupa opcji
      if (i % 2 === 1) {
        const opts = part.split("/").map((o) => o.trim()).filter(Boolean);
        const blankKey = `${key}_${Math.floor(i / 2)}`;
        const cur = ans[blankKey] || "";
        return (
          <View
            key={i}
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 4,
              marginVertical: 3,
            }}
          >
            {opts.map((o) => {
              const isSel = cur === o;
              return (
                <TouchableOpacity
                  key={o}
                  onPress={() =>
                    onChange({ ...ans, [blankKey]: isSel ? "" : o })
                  }
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: isSel ? colors.brand[500] : theme.border,
                    backgroundColor: isSel
                      ? colors.brand[500] + "1A"
                      : theme.inputBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isSel ? colors.brand[600] : theme.text,
                    }}
                  >
                    {o}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }
      return (
        <Text
          key={i}
          style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}
        >
          {part}
        </Text>
      );
    });
  };

  const rows = sentences.length > 0 ? sentences : blanksAlt;

  return (
    <View style={{ gap: 12 }}>
      {rows.map((s: any, i: number) => {
        const sid = s.id || `s${i}`;
        const text = s.text || s.sentence || "";
        // Wariant 3: blanks z osobnymi options
        if (Array.isArray(s.options) && s.options.length > 0) {
          const cur = ans[sid] || "";
          return (
            <View
              key={sid}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              {text ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.text,
                    lineHeight: 20,
                    marginBottom: 8,
                  }}
                >
                  {text}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {s.options.map((opt: string) => {
                  const isSel = cur === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() =>
                        onChange({ ...ans, [sid]: isSel ? "" : opt })
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: isSel ? colors.brand[500] : theme.border,
                        backgroundColor: isSel
                          ? colors.brand[500] + "1A"
                          : theme.inputBg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: isSel ? colors.brand[600] : theme.text,
                        }}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }
        // Wariant 1/2: zdanie z nawiasami
        return (
          <View
            key={sid}
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.borderLight,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {parseSentence(text, sid)}
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CodeEditor — monospace textarea z trzymaniem tabów
// ─────────────────────────────────────────────────────────────────────────────

function CodeEditor({
  value,
  onChange,
  placeholder,
  theme,
  isDark,
  minHeight = 220,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  theme: any;
  isDark: boolean;
  minHeight?: number;
}) {
  return (
    <ClearableTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.textTertiary}
      multiline
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      style={{
        backgroundColor: isDark ? "#0f172a" : "#1e293b",
        borderWidth: 1,
        borderColor: isDark ? "#1e293b" : "#334155",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: "#e2e8f0",
        minHeight,
        fontFamily: "monospace",
        textAlignVertical: "top",
        lineHeight: 18,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO_ALGORITHM
// ─────────────────────────────────────────────────────────────────────────────

function AlgorithmRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  return (
    <View style={{ gap: 12 }}>
      {(c.allowedLanguages || []).length > 0 && (
        <View
          style={{
            padding: 10,
            borderRadius: 10,
            backgroundColor: theme.inputBg,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary }}>
            Dozwolone:
          </Text>
          {c.allowedLanguages.map((l: string) => (
            <View
              key={l}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: colors.brand[500] + "20",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.brand[600],
                }}
              >
                {l}
              </Text>
            </View>
          ))}
        </View>
      )}
      {c.specification && (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "#78350f15" : "#fffbeb",
            borderWidth: 1,
            borderColor: isDark ? "#92400e40" : "#fde68a",
          }}
        >
          {c.specification.dane && (
            <Text style={{ fontSize: 12, color: theme.text, marginBottom: 4 }}>
              <Text style={{ fontWeight: "700" }}>Dane: </Text>
              {c.specification.dane}
            </Text>
          )}
          {c.specification.wynik && (
            <Text style={{ fontSize: 12, color: theme.text }}>
              <Text style={{ fontWeight: "700" }}>Wynik: </Text>
              {c.specification.wynik}
            </Text>
          )}
        </View>
      )}
      <CodeEditor
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        placeholder="// Wpisz algorytm / pseudokod..."
        theme={theme}
        isDark={isDark}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO_ANALYSIS — kod do analizy + textarea
// ─────────────────────────────────────────────────────────────────────────────

function AnalysisRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  return (
    <View style={{ gap: 12 }}>
      {c.code && (
        <View
          style={{
            backgroundColor: isDark ? "#0f172a" : "#1e293b",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {c.language ? (
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                color: "#94a3b8",
                marginBottom: 6,
                letterSpacing: 0.5,
              }}
            >
              {c.language.toUpperCase()}
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
              {c.code}
            </Text>
          </ScrollView>
        </View>
      )}
      <ClearableTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
        value={typeof value === "string" ? value : ""}
        onChangeText={onChange}
        placeholder="Wpisz analizę kodu..."
        placeholderTextColor={theme.textTertiary}
        multiline
        style={{
          backgroundColor: theme.inputBg,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
          color: theme.text,
          minHeight: 160,
          textAlignVertical: "top",
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO_PROGRAMMING — dataFiles + code + answers
// ─────────────────────────────────────────────────────────────────────────────

function ProgrammingRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const v =
    typeof value === "object" && value && !Array.isArray(value)
      ? value
      : { code: "", answers: {} as Record<string, string> };

  return (
    <View style={{ gap: 12 }}>
      {(c.allowedLanguages || []).length > 0 && (
        <View
          style={{
            padding: 10,
            borderRadius: 10,
            backgroundColor: theme.inputBg,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary }}>
            Dozwolone:
          </Text>
          {c.allowedLanguages.map((l: string) => (
            <View
              key={l}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: colors.brand[500] + "20",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.brand[600],
                }}
              >
                {l}
              </Text>
            </View>
          ))}
        </View>
      )}

      {(c.dataFiles || []).map((f: any, i: number) => (
        <View
          key={i}
          style={{
            backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
            borderRadius: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: colors.brand[600],
              marginBottom: 4,
            }}
          >
            📄 {f.name}
          </Text>
          {f.description ? (
            <Text
              style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}
            >
              {f.description}
            </Text>
          ) : null}
          <ScrollView style={{ maxHeight: 140 }}>
            <ScrollView horizontal>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  lineHeight: 16,
                }}
              >
                {f.content}
              </Text>
            </ScrollView>
          </ScrollView>
        </View>
      ))}

      <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textTertiary }}>
        KOD:
      </Text>
      <CodeEditor
        value={v.code || ""}
        onChange={(t) => onChange({ ...v, code: t })}
        placeholder="// Wpisz kod..."
        theme={theme}
        isDark={isDark}
        minHeight={200}
      />

      {(c.expectedAnswers || []).length > 0 && (
        <>
          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textTertiary }}>
            ODPOWIEDZI:
          </Text>
          <View style={{ gap: 8 }}>
            {c.expectedAnswers.map((a: any) => (
              <View key={a.id}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: theme.text,
                    marginBottom: 4,
                  }}
                >
                  {a.label}
                </Text>
                <SymTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
                  value={(v.answers || {})[a.id] || ""}
                  onChangeText={(t) =>
                    onChange({
                      ...v,
                      answers: { ...(v.answers || {}), [a.id]: t },
                    })
                  }
                  placeholder={a.format === "number" ? "0" : "..."}
                  placeholderTextColor={theme.textTertiary}
                  keyboardType={a.format === "number" ? "numbers-and-punctuation" : "default"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 14,
                    color: theme.text,
                    fontFamily: "monospace",
                  }}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SqlSchemaView — wspólny viewer schema bazy (tables + fields + sample rows +
// relations). Używany w SqlRenderer (zadania) i DbSchemaMaterial (materiały).
// ─────────────────────────────────────────────────────────────────────────────

export function SqlSchemaView({
  schema,
  theme,
  isDark,
}: {
  schema: any;
  theme: any;
  isDark: boolean;
}) {
  const tables = Array.isArray(schema?.tables) ? schema.tables : [];
  const relations = Array.isArray(schema?.relations) ? schema.relations : [];
  // Szerokość kolumny z nazwy pola i najdłuższej wartości w przykładowych
  // danych — nagłówek i wiersze muszą trzymać tę samą siatkę.
  const sampleColW = (t: any, name: string) => {
    const vals = (Array.isArray(t?.sampleRows) ? t.sampleRows : [])
      .slice(0, 5)
      .map((r: any) => String(r?.[name] ?? ""));
    const chars = vals.reduce((m: number, s: string) => Math.max(m, s.length), name.length);
    return Math.round(Math.min(Math.max(chars * 6 + 18, 80), 180));
  };
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: theme.inputBg,
        borderWidth: 1,
        borderColor: theme.border,
        gap: 12,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color: theme.textTertiary,
          letterSpacing: 0.5,
        }}
      >
        SCHEMA
      </Text>
      {tables.map((t: any) => (
        <View key={t.name} style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: colors.brand[600],
              fontFamily: "monospace",
            }}
          >
            {t.name}
          </Text>
          {(t.fields || []).map((f: any) => (
            <View
              key={f.name}
              style={{ flexDirection: "row", marginLeft: 8, gap: 6 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: theme.text,
                  fontFamily: "monospace",
                }}
              >
                •
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.text,
                  fontFamily: "monospace",
                  flex: 1,
                }}
              >
                <Text style={{ fontWeight: "700" }}>{f.name}</Text>:{" "}
                {f.type}
                {f.isPrimary ? (
                  <Text style={{ color: colors.brand[600], fontWeight: "800" }}>
                    {" "}
                    PK
                  </Text>
                ) : null}
                {f.isForeign || f.references ? (
                  <Text style={{ color: "#f59e0b", fontWeight: "800" }}>
                    {" "}
                    FK
                  </Text>
                ) : null}
              </Text>
            </View>
          ))}

          {/* Sample rows */}
          {Array.isArray(t.sampleRows) && t.sampleRows.length > 0 && (
            <ScrollView
              horizontal
              style={{ marginTop: 6 }}
              showsHorizontalScrollIndicator
            >
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                }}
              >
                {/* Header z nazwami kolumn */}
                <View style={{ flexDirection: "row" }}>
                  {(t.fields || []).map((f: any, fi: number) => (
                    <View
                      key={f.name}
                      style={{
                        width: sampleColW(t, f.name),
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRightWidth: fi < t.fields.length - 1 ? 1 : 0,
                        borderColor: theme.border,
                        backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: theme.text,
                          fontFamily: "monospace",
                        }}
                      >
                        {f.name}
                      </Text>
                    </View>
                  ))}
                </View>
                {/* Sample rows */}
                {t.sampleRows.slice(0, 5).map((row: any, ri: number) => (
                  <View
                    key={ri}
                    style={{
                      flexDirection: "row",
                      borderTopWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    {(t.fields || []).map((f: any, fi: number) => (
                      <View
                        key={f.name}
                        style={{
                          width: sampleColW(t, f.name),
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRightWidth: fi < t.fields.length - 1 ? 1 : 0,
                          borderColor: theme.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            color: theme.text,
                            fontFamily: "monospace",
                          }}
                        >
                          {String(row[f.name] ?? "")}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
                {t.sampleRows.length > 5 && (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderTopWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Text
                      style={{ fontSize: 10, color: theme.textTertiary }}
                    >
                      … i {t.sampleRows.length - 5} więcej wierszy
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      ))}

      {/* Relations */}
      {relations.length > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              color: theme.textTertiary,
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            RELACJE
          </Text>
          {relations.map((r: any, i: number) => (
            <Text
              key={i}
              style={{
                fontSize: 11,
                color: theme.text,
                fontFamily: "monospace",
                marginLeft: 8,
              }}
            >
              ↔ {typeof r === "string" ? r : `${r.from} → ${r.to}`}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO_SQL — schema + query
// ─────────────────────────────────────────────────────────────────────────────

function SqlRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const v =
    typeof value === "object" && value && !Array.isArray(value)
      ? value
      : { query: "", result: "" };

  return (
    <View style={{ gap: 12 }}>
      {c.schema && (
        <SqlSchemaView schema={c.schema} theme={theme} isDark={isDark} />
      )}
      <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textTertiary }}>
        ZAPYTANIE SQL:
      </Text>
      <CodeEditor
        value={v.query || ""}
        onChange={(t) => onChange({ ...v, query: t })}
        placeholder="SELECT ..."
        theme={theme}
        isDark={isDark}
        minHeight={160}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO_SPREADSHEET — dataFiles + method + answers
// ─────────────────────────────────────────────────────────────────────────────

function SpreadsheetRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const v =
    typeof value === "object" && value && !Array.isArray(value)
      ? value
      : { method: "", answers: {} as Record<string, string> };

  return (
    <View style={{ gap: 12 }}>
      {(c.dataFiles || []).map((f: any, i: number) => (
        <View
          key={i}
          style={{
            backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
            borderRadius: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: colors.brand[600],
              marginBottom: 4,
            }}
          >
            📊 {f.name}
          </Text>
          {f.description ? (
            <Text
              style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}
            >
              {f.description}
            </Text>
          ) : null}
          <ScrollView style={{ maxHeight: 160 }}>
            <ScrollView horizontal>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: isDark ? "#e2e8f0" : "#0f172a",
                  lineHeight: 16,
                }}
              >
                {f.content}
              </Text>
            </ScrollView>
          </ScrollView>
        </View>
      ))}

      <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textTertiary }}>
        METODA / FORMUŁA:
      </Text>
      <CodeEditor
        value={v.method || ""}
        onChange={(t) => onChange({ ...v, method: t })}
        placeholder="=SUMA(A1:A100) / opis kroków..."
        theme={theme}
        isDark={isDark}
        minHeight={140}
      />

      {(c.expectedAnswers || []).length > 0 && (
        <>
          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textTertiary }}>
            WYNIKI:
          </Text>
          <View style={{ gap: 8 }}>
            {c.expectedAnswers.map((a: any) => (
              <View key={a.id}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: theme.text,
                    marginBottom: 4,
                  }}
                >
                  {a.label}
                </Text>
                <SymTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
                  value={(v.answers || {})[a.id] || ""}
                  onChangeText={(t) =>
                    onChange({
                      ...v,
                      answers: { ...(v.answers || {}), [a.id]: t },
                    })
                  }
                  placeholder={a.format === "number" ? "0" : "..."}
                  placeholderTextColor={theme.textTertiary}
                  keyboardType={a.format === "number" ? "numbers-and-punctuation" : "default"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 14,
                    color: theme.text,
                  }}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE_FILL — grid komórek
// ─────────────────────────────────────────────────────────────────────────────

function TableFillRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const headers: string[] = Array.isArray(c.headers) ? c.headers : [];
  const rows: any[] = Array.isArray(c.rows) ? c.rows : [];
  const ans =
    typeof value === "object" && value && !Array.isArray(value) ? value : {};

  // Jedna szerokość kolumny dla nagłówka, etykiet i pól — inaczej nagłówek
  // z długim tytułem był szerszy od komórek i kolumny się rozjeżdżały
  // (zgłoszone 17.09.2026). Szacowanie z liczby znaków: fontSize 12 ≈ 6.5 px.
  const labelChars = rows.reduce(
    (m: number, r: any) => Math.max(m, String(r?.label ?? "").length),
    0,
  );
  const colW = (i: number) => {
    const head = String(headers[i] ?? "");
    const chars = i === 0 ? Math.max(head.length, labelChars) : head.length;
    return Math.round(Math.min(Math.max(chars * 6.5 + 22, 120), 220));
  };

  return (
    <View>
      <HScroll>
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          {headers.length > 0 && (
            <View style={{ flexDirection: "row", backgroundColor: theme.inputBg }}>
              {headers.map((h, i) => (
                <View
                  key={i}
                  style={{
                    width: colW(i),
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRightWidth: i < headers.length - 1 ? 1 : 0,
                    borderColor: theme.border,
                  }}
                >
                  <Text
                    style={{ fontSize: 12, fontWeight: "800", color: theme.text }}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {/* Rows */}
          {rows.map((row: any, ri: number) => {
            const fields: any[] = Array.isArray(row.fields)
              ? row.fields
              : Array.isArray(row.cells)
                ? row.cells
                : Array.from({ length: Math.max(0, headers.length - 1) });
            return (
              <View
                key={ri}
                style={{
                  flexDirection: "row",
                  borderTopWidth: 1,
                  borderColor: theme.border,
                }}
              >
                {/* Label column */}
                {row.label !== undefined && (
                  <View
                    style={{
                      width: colW(0),
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRightWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.inputBg,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.text }}>
                      {row.label}
                    </Text>
                  </View>
                )}
                {fields.map((_f: any, fi: number) => {
                  const cellId = `${ri}_${fi}`;
                  return (
                    <View
                      key={fi}
                      style={{
                        width: colW(row.label !== undefined ? fi + 1 : fi),
                        padding: 2,
                        borderRightWidth: fi < fields.length - 1 ? 1 : 0,
                        borderColor: theme.border,
                      }}
                    >
                      <SymTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
                        value={ans[cellId] || ""}
                        onChangeText={(t) => onChange({ ...ans, [cellId]: t })}
                        placeholder="…"
                        placeholderTextColor={theme.textTertiary}
                        autoCorrect={false}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          fontSize: 13,
                          color: theme.text,
                          fontFamily: "monospace",
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </HScroll>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HIST_IDENTIFY_PERSONS — biogramy + input z nazwiskiem
// ─────────────────────────────────────────────────────────────────────────────

function IdentifyPersonsRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const bios: any[] = Array.isArray(task.content?.biographies)
    ? task.content.biographies
    : [];
  const ans =
    typeof value === "object" && value && !Array.isArray(value) ? value : {};
  // Jedna postać na portrecie: bez biogramów (content pusty, ilustracja
  // w materialIds) odpowiedź to zwykły tekst. Bez tego zadanie nie miało
  // pola odpowiedzi wcale (Historia PR #3 zad. 2) — web: HistoriaTaskRenderers
  // renderIdentifyPersons obsługuje ten sam przypadek tak samo.
  if (bios.length === 0) {
    const text = typeof value === "string" ? value : "";
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
          Rozpoznaj postać na podstawie materiału i odpowiedz zgodnie z poleceniem, pełnym zdaniem.
        </Text>
        <TextInput
          value={text}
          onChangeText={onChange}
          multiline
          placeholder="Wpisz odpowiedź..."
          placeholderTextColor={theme.textTertiary}
          textAlignVertical="top"
          style={{
            minHeight: 120,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
            color: theme.text,
            fontSize: 15,
            lineHeight: 21,
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {bios.map((b: any) => (
        <View
          key={b.id}
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.brand[500],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>
                {b.id}
              </Text>
            </View>
            <Text
              style={{ fontSize: 12, color: theme.textSecondary, fontStyle: "italic" }}
            >
              Biogram
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              color: theme.text,
              lineHeight: 20,
              marginBottom: 10,
            }}
          >
            {b.text}
          </Text>
          <TextInput autoComplete="off" importantForAutofill="no" textContentType="none"
            value={ans[b.id] || ""}
            onChangeText={(t) => onChange({ ...ans, [b.id]: t })}
            placeholder="Imię i nazwisko"
            placeholderTextColor={theme.textTertiary}
            autoCorrect={false}
            style={{
              backgroundColor: theme.inputBg,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              color: theme.text,
            }}
          />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESSAY (historia 15pt / wos 5-10pt) — wybór tematu + textarea + word counter
// ─────────────────────────────────────────────────────────────────────────────

function EssayRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const topics: any[] = Array.isArray(c.topics) ? c.topics : [];
  const minWords = c.minWords || c.wordCount?.min || 100;
  const maxWords = c.maxWords || c.wordCount?.max;

  const v =
    typeof value === "object" && value && !Array.isArray(value)
      ? value
      : { topic: null, text: "" };

  const text = v.text || "";
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const selectedTopic =
    topics.find((t: any) => Number(t.number || t.id) === Number(v.topic)) ||
    null;

  const update = (patch: any) => onChange({ ...v, ...patch });

  return (
    <View style={{ gap: 14 }}>
      {/* Wybór tematu */}
      {topics.length > 0 && (
        <View>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: theme.textTertiary,
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            WYBIERZ JEDEN TEMAT:
          </Text>
          <View style={{ gap: 8 }}>
            {topics.map((t: any) => {
              const tid = Number(t.number || t.id);
              const sel = Number(v.topic) === tid;
              return (
                <TouchableOpacity
                  key={tid}
                  onPress={() => update({ topic: tid })}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: sel ? colors.brand[500] : theme.border,
                    backgroundColor: sel
                      ? colors.brand[500] + "15"
                      : theme.inputBg,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: sel ? colors.brand[500] : theme.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}
                      >
                        {tid}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        color: theme.text,
                        flex: 1,
                      }}
                    >
                      {t.title || t.thesis || `Temat ${tid}`}
                    </Text>
                  </View>
                  {t.thesis && t.title && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.textSecondary,
                        lineHeight: 18,
                      }}
                    >
                      {t.thesis}
                    </Text>
                  )}
                  {Array.isArray(t.elements) && t.elements.length > 0 && (
                    <View style={{ marginTop: 6, gap: 2 }}>
                      {t.elements.map((el: string, i: number) => (
                        <Text
                          key={i}
                          style={{
                            fontSize: 11,
                            color: theme.textTertiary,
                            lineHeight: 16,
                          }}
                        >
                          • {el}
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {topics.length > 0 && !selectedTopic && (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "#78350f15" : "#fffbeb",
            borderWidth: 1,
            borderColor: isDark ? "#92400e40" : "#fde68a",
          }}
        >
          <Text style={{ fontSize: 13, color: isDark ? "#fbbf24" : "#92400e" }}>
            Wybierz temat powyżej, by rozpocząć pisanie.
          </Text>
        </View>
      )}

      {(topics.length === 0 || selectedTopic) && (
        <>
          <ClearableTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
            value={text}
            onChangeText={(t) => update({ text: t })}
            placeholder="Napisz wypowiedź..."
            placeholderTextColor={theme.textTertiary}
            multiline
            style={{
              backgroundColor: theme.inputBg,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: theme.text,
              minHeight: 260,
              textAlignVertical: "top",
              lineHeight: 22,
            }}
          />
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color:
                  wordCount < minWords
                    ? "#f59e0b"
                    : maxWords && wordCount > maxWords
                      ? "#ef4444"
                      : "#10b981",
                fontVariant: ["tabular-nums"],
              }}
            >
              {wordCount} / {minWords}
              {maxWords ? `–${maxWords}` : "+"} wyrazów
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DECIDE_JUSTIFY — buttony decyzji + textarea uzasadnienia
// ─────────────────────────────────────────────────────────────────────────────

function DecideJustifyRenderer({ task, value, onChange, theme, isDark }: RenderProps) {
  const c = task.content || {};
  const opts: string[] = Array.isArray(c.decisionOptions)
    ? c.decisionOptions
    : Array.isArray(c.options)
      ? c.options.map((o: any) => (typeof o === "string" ? o : o.text || o.id))
      : ["Tak", "Nie"];

  const v =
    typeof value === "object" && value && !Array.isArray(value)
      ? value
      : { decision: "", justification: "" };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: theme.textTertiary,
            marginBottom: 8,
            letterSpacing: 0.5,
          }}
        >
          DECYZJA:
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {opts.map((o) => {
            const sel = v.decision === o;
            return (
              <TouchableOpacity
                key={o}
                onPress={() =>
                  onChange({ ...v, decision: sel ? "" : o })
                }
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: sel ? colors.brand[500] : theme.border,
                  backgroundColor: sel ? colors.brand[500] + "1A" : theme.inputBg,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: sel ? colors.brand[600] : theme.text,
                  }}
                >
                  {o}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: theme.textTertiary,
            marginBottom: 6,
            letterSpacing: 0.5,
          }}
        >
          UZASADNIENIE:
        </Text>
        <SymClearableTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
          value={v.justification || ""}
          onChangeText={(t) => onChange({ ...v, justification: t })}
          placeholder="Uzasadnij swoją decyzję..."
          placeholderTextColor={theme.textTertiary}
          multiline
          style={{
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: theme.text,
            minHeight: 160,
            textAlignVertical: "top",
            lineHeight: 22,
          }}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE_RECOGNITION (historia) — input stylu + dwie cechy
// ─────────────────────────────────────────────────────────────────────────────

function StyleRecognitionRenderer({ task, value, onChange, theme }: RenderProps) {
  const v =
    typeof value === "object" && value && !Array.isArray(value)
      ? value
      : { styleName: "", features: ["", ""] };
  const features: string[] = Array.isArray(v.features)
    ? v.features
    : ["", ""];

  const updateFeature = (i: number, t: string) => {
    const nf = [...features];
    nf[i] = t;
    onChange({ ...v, features: nf });
  };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: theme.textTertiary,
            marginBottom: 6,
            letterSpacing: 0.5,
          }}
        >
          STYL ARCHITEKTONICZNY:
        </Text>
        <TextInput autoComplete="off" importantForAutofill="no" textContentType="none"
          value={v.styleName || ""}
          onChangeText={(t) => onChange({ ...v, styleName: t })}
          placeholder="np. gotycki, barokowy, klasycystyczny..."
          placeholderTextColor={theme.textTertiary}
          autoCorrect={false}
          style={{
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 14,
            color: theme.text,
          }}
        />
      </View>
      <View>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: theme.textTertiary,
            marginBottom: 6,
            letterSpacing: 0.5,
          }}
        >
          CECHY CHARAKTERYSTYCZNE (min. 2):
        </Text>
        <View style={{ gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: theme.textSecondary,
                  minWidth: 18,
                }}
              >
                {i + 1}.
              </Text>
              <TextInput autoComplete="off" importantForAutofill="no" textContentType="none"
                value={features[i] || ""}
                onChangeText={(t) => updateFeature(i, t)}
                placeholder={
                  i < 2 ? "np. ostrołukowe okna" : "(opcjonalne — trzecia cecha)"
                }
                placeholderTextColor={theme.textTertiary}
                autoCorrect={false}
                style={{
                  flex: 1,
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 14,
                  color: theme.text,
                }}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export function Tier2TaskRenderer(props: RenderProps) {
  const suffix = getSuffix(props.task.type);
  switch (suffix) {
    case "sequence":
      return <SequenceRenderer {...props} />;
    case "cross_punnett":
      return <PunnettRenderer {...props} />;
    case "scheme_fill":
      return <SchemeFillRenderer {...props} />;
    case "fill_choose":
      return <FillChooseRenderer {...props} />;
    case "algorithm":
      return <AlgorithmRenderer {...props} />;
    case "programming":
      return <ProgrammingRenderer {...props} />;
    case "sql":
      return <SqlRenderer {...props} />;
    case "spreadsheet":
      return <SpreadsheetRenderer {...props} />;
    case "analysis":
      return <AnalysisRenderer {...props} />;
    case "table_fill":
    case "fill_table":
      return <TableFillRenderer {...props} />;
    case "identify_persons":
      return <IdentifyPersonsRenderer {...props} />;
    case "essay_5pt":
    case "essay_7pt":
    case "essay_10pt":
    case "essay_15pt":
      return <EssayRenderer {...props} />;
    case "decide_justify":
      return <DecideJustifyRenderer {...props} />;
    case "style_recognition":
      return <StyleRecognitionRenderer {...props} />;
    default:
      return (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: "#fef2f2",
            borderWidth: 1,
            borderColor: "#fecaca",
          }}
        >
          <Text style={{ fontSize: 13, color: "#b91c1c", fontWeight: "600" }}>
            Tier 2: brak renderera dla „{props.task.type}”
          </Text>
        </View>
      );
  }
}
