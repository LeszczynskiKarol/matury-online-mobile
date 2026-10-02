// ============================================================================
// SymbolPalette — „∑ Symbole matematyczne” (unicode, bez LaTeX-a)
//
//  • SymbolPalette — przycisk + paleta; woła onInsert(symbol). Używa jej
//    MathEditor (jedno duże pole) i SymbolScope (wiele małych pól).
//  • SymbolScope + withSymbols — pasek dla wielu małych pól (luki, komórki
//    tabel, wartość z jednostką). Pole owinięte withSymbols(...) zgłasza się
//    do najbliższego SymbolScope; symbol trafia do pola, w którym ostatnio był
//    kursor (albo do pierwszego, gdy uczeń jeszcze żadnego nie dotknął).
//    Pasek chowa się, gdy w zakresie nie ma żadnego edytowalnego pola.
//    Poza SymbolScope owinięte pole działa jak zwykłe.
//
// Karol 2.10.2026: luki i tabele w przedmiotach ścisłych nie miały symboli
// (μ, Δ, λ, ², ½…). Tylko przedmioty ścisłe — o tym decyduje ekran
// (isMathSubject), nie ten komponent.
// ============================================================================

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

export const SYMBOL_GROUPS = [
  {
    label: "Potęgi",
    symbols: [
      { label: "x²", insert: "²" },
      { label: "x³", insert: "³" },
      { label: "xⁿ", insert: "ⁿ" },
      { label: "x⁻¹", insert: "⁻¹" },
      { label: "x₁", insert: "₁" },
      { label: "x₂", insert: "₂" },
      { label: "x₀", insert: "₀" },
      { label: "xₙ", insert: "ₙ" },
    ],
  },
  {
    label: "Operatory",
    symbols: [
      { label: "√", insert: "√" },
      { label: "±", insert: "±" },
      { label: "·", insert: "·" },
      { label: "×", insert: "×" },
      { label: "÷", insert: "÷" },
      { label: "∞", insert: "∞" },
      { label: "Δ", insert: "Δ" },
      { label: "→", insert: "→" },
    ],
  },
  {
    label: "Relacje",
    symbols: [
      { label: "≤", insert: "≤" },
      { label: "≥", insert: "≥" },
      { label: "≠", insert: "≠" },
      { label: "≈", insert: "≈" },
      { label: "⇒", insert: "⇒" },
      { label: "⇔", insert: "⇔" },
      { label: "∈", insert: "∈" },
      { label: "∉", insert: "∉" },
    ],
  },
  {
    label: "Zbiory",
    symbols: [
      { label: "∪", insert: "∪" },
      { label: "∩", insert: "∩" },
      { label: "⊂", insert: "⊂" },
      { label: "∅", insert: "∅" },
      { label: "ℝ", insert: "ℝ" },
      { label: "ℕ", insert: "ℕ" },
      { label: "ℤ", insert: "ℤ" },
      { label: "ℚ", insert: "ℚ" },
    ],
  },
  {
    label: "Greckie",
    symbols: [
      { label: "π", insert: "π" },
      { label: "α", insert: "α" },
      { label: "β", insert: "β" },
      { label: "γ", insert: "γ" },
      { label: "θ", insert: "θ" },
      { label: "φ", insert: "φ" },
      { label: "λ", insert: "λ" },
      { label: "σ", insert: "σ" },
    ],
  },
  {
    label: "Analiza",
    symbols: [
      { label: "∑", insert: "∑" },
      { label: "∫", insert: "∫" },
      { label: "∂", insert: "∂" },
      { label: "lim", insert: "lim " },
      { label: "sin", insert: "sin " },
      { label: "cos", insert: "cos " },
      { label: "tg", insert: "tg " },
      { label: "log", insert: "log " },
    ],
  },
  {
    label: "Nawiasy",
    symbols: [
      { label: "⟨⟩", insert: "⟨⟩" },
      { label: "⌊⌋", insert: "⌊⌋" },
      { label: "⌈⌉", insert: "⌈⌉" },
      { label: "|x|", insert: "||" },
      { label: "½", insert: "½" },
      { label: "⅓", insert: "⅓" },
      { label: "¼", insert: "¼" },
      { label: "‰", insert: "‰" },
    ],
  },
  {
    label: "Fizyka i chemia",
    symbols: [
      { label: "μ", insert: "μ" },
      { label: "Ω", insert: "Ω" },
      { label: "ω", insert: "ω" },
      { label: "ρ", insert: "ρ" },
      { label: "η", insert: "η" },
      { label: "°", insert: "°" },
      { label: "⇄", insert: "⇄" },
      { label: "↑", insert: "↑" },
      { label: "↓", insert: "↓" },
      { label: "x⁺", insert: "⁺" },
      { label: "x⁻", insert: "⁻" },
      { label: "x₃", insert: "₃" },
      { label: "x₄", insert: "₄" },
    ],
  },
];

export function SymbolPalette({
  onInsert,
  hint,
}: {
  onInsert: (symbol: string) => void;
  /** Linijka pod paletą (np. „Symbol trafia do pola, w którym jest kursor.”). */
  hint?: string;
}) {
  const { colors: theme, isDark } = useTheme();
  const [showSymbols, setShowSymbols] = useState(false);
  const [activeGroup, setActiveGroup] = useState(-1);

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => setShowSymbols(!showSymbols)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 14,
            backgroundColor: showSymbols
              ? isDark
                ? colors.brand[500] + "20"
                : "#dcfce7"
              : isDark
                ? theme.card
                : "#f4f4f5",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: showSymbols ? colors.brand[500] : theme.textSecondary,
            }}
          >
            ∑
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: showSymbols ? colors.brand[500] : theme.textSecondary,
            }}
          >
            Symbole matematyczne
          </Text>
          <Ionicons
            name={showSymbols ? "chevron-up" : "chevron-down"}
            size={12}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {showSymbols && (
        <View
          style={{
            borderRadius: 16,
            marginBottom: 10,
            backgroundColor: isDark ? theme.card : "#f9fafb",
            borderWidth: 1,
            borderColor: theme.border,
            padding: 10,
            gap: 10,
          }}
        >
          {/* Taby kategorii — "Wszystkie" jako default */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", gap: 5 }}>
              {[{ label: "Wszystkie" }, ...SYMBOL_GROUPS].map((g, i) => {
                const gi = i - 1;
                const on = activeGroup === gi;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setActiveGroup(gi === -1 || activeGroup !== gi ? gi : -1)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      backgroundColor: on ? colors.brand[500] : isDark ? "#27272a" : "#e4e4e7",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: on ? "#fff" : theme.textSecondary,
                      }}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Symbole — filtrowane lub wszystkie */}
          {(activeGroup === -1 ? SYMBOL_GROUPS : [SYMBOL_GROUPS[activeGroup]]).map((group, gi) => (
            <View key={gi}>
              {activeGroup === -1 && (
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: theme.textTertiary,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    marginBottom: 5,
                    marginLeft: 2,
                  }}
                >
                  {group.label}
                </Text>
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                {group.symbols.map((s, si) => (
                  <TouchableOpacity
                    key={si}
                    onPress={() => onInsert(s.insert)}
                    style={{
                      width: 40,
                      height: 36,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isDark ? "#27272a" : "#fff",
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {activeGroup === -1 && gi < SYMBOL_GROUPS.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: theme.border,
                    marginTop: 8,
                    opacity: 0.4,
                  }}
                />
              )}
            </View>
          ))}
          {hint ? <Text style={{ fontSize: 11, color: theme.textTertiary }}>{hint}</Text> : null}
        </View>
      )}
    </>
  );
}

// ── Wiele małych pól ──────────────────────────────────────────────────────

type Field = {
  getValue: () => string;
  setValue: (v: string) => void;
  sel: { start: number; end: number } | null;
  setSelection: (start: number) => void;
};

type ScopeApi = {
  register: (f: Field) => () => void;
  focus: (f: Field) => void;
};

const SymbolScopeContext = createContext<ScopeApi | null>(null);

/** Zakres pól z jednym paskiem symboli nad nimi. `enabled=false` → bez paska
 *  (pola działają normalnie) — np. przedmiot humanistyczny albo zadanie
 *  zablokowane. */
export function SymbolScope({ enabled = true, children }: { enabled?: boolean; children: React.ReactNode }) {
  const fields = useRef<Field[]>([]);
  const last = useRef<Field | null>(null);
  const [count, setCount] = useState(0);

  const api = useMemo<ScopeApi>(
    () => ({
      register: (f) => {
        fields.current.push(f);
        setCount(fields.current.length);
        return () => {
          fields.current = fields.current.filter((x) => x !== f);
          if (last.current === f) last.current = null;
          setCount(fields.current.length);
        };
      },
      focus: (f) => {
        last.current = f;
      },
    }),
    [],
  );

  const insert = useCallback((symbol: string) => {
    const f = last.current ?? fields.current[0];
    if (!f) return;
    const v = f.getValue() ?? "";
    const start = Math.min(f.sel?.start ?? v.length, v.length);
    const end = Math.min(f.sel?.end ?? v.length, v.length);
    f.setValue(v.slice(0, start) + symbol + v.slice(end));
    const pos = start + symbol.length;
    f.sel = { start: pos, end: pos };
    last.current = f;
    setTimeout(() => f.setSelection(pos), 10);
  }, []);

  if (!enabled) return <>{children}</>;
  return (
    <SymbolScopeContext.Provider value={api}>
      {count > 0 && <SymbolPalette onInsert={insert} hint="Symbol trafia do pola, w którym jest kursor." />}
      {children}
    </SymbolScopeContext.Provider>
  );
}

type InputLike = {
  value?: string;
  onChangeText?: (v: string) => void;
  editable?: boolean;
  onFocus?: (e: any) => void;
  onSelectionChange?: (e: any) => void;
};

/** Owija TextInput-podobny komponent tak, żeby zgłaszał się do SymbolScope. */
export function withSymbols<P extends InputLike>(Comp: React.ComponentType<P>) {
  const Wrapped = forwardRef<any, P>(function SymbolField(props, ref) {
    const scope = useContext(SymbolScopeContext);
    const inner = useRef<any>(null);
    const latest = useRef(props);
    latest.current = props;
    const field = useRef<Field | null>(null);
    if (!field.current) {
      field.current = {
        getValue: () => latest.current.value ?? "",
        setValue: (v) => latest.current.onChangeText?.(v),
        sel: null,
        setSelection: (pos) => {
          try {
            if (inner.current?.setSelection) inner.current.setSelection(pos, pos);
            else inner.current?.setNativeProps?.({ selection: { start: pos, end: pos } });
          } catch {}
        },
      };
    }
    const editable = props.editable !== false && !!props.onChangeText;

    useEffect(() => {
      if (!scope || !editable) return;
      return scope.register(field.current!);
    }, [scope, editable]);

    const setRef = useCallback(
      (node: any) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<any>).current = node;
      },
      [ref],
    );

    if (!scope) return <Comp {...(props as P)} ref={ref} />;
    return (
      <Comp
        {...(props as P)}
        ref={setRef}
        onFocus={(e: any) => {
          scope.focus(field.current!);
          props.onFocus?.(e);
        }}
        onSelectionChange={(e: any) => {
          field.current!.sel = e?.nativeEvent?.selection ?? null;
          props.onSelectionChange?.(e);
        }}
      />
    );
  });
  return Wrapped;
}
