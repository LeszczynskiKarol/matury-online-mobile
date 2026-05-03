// ============================================================================
// MathEditor — Mobile: single TextInput + symbol palette
// Symbols insert as unicode directly into text
// ============================================================================

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { MathEditorExample } from "./MathEditorExample";

interface MathEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  taskType?: string;
  showExample?: boolean;
}

// ── Unicode symbols (no LaTeX — directly readable) ───────────────────────

const SYMBOL_GROUPS = [
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
];

export function MathEditor({
  value,
  onChange,
  placeholder,
  taskType,
  showExample = true,
}: MathEditorProps) {
  const { colors: theme, isDark } = useTheme();
  const [showSymbols, setShowSymbols] = useState(false);
  const [activeGroup, setActiveGroup] = useState(-1);
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef<{ start: number; end: number }>({
    start: value.length,
    end: value.length,
  });

  const insertSymbol = useCallback(
    (symbol: string) => {
      const pos = selectionRef.current.start;
      const before = value.slice(0, pos);
      const after = value.slice(selectionRef.current.end);
      const newValue = before + symbol + after;
      const newPos = pos + symbol.length;
      onChange(newValue);
      // Restore cursor after symbol
      setTimeout(() => {
        inputRef.current?.setNativeProps({
          selection: { start: newPos, end: newPos },
        });
        selectionRef.current = { start: newPos, end: newPos };
      }, 10);
    },
    [value, onChange],
  );

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <View>
      {/* Example */}
      {showExample && <MathEditorExample taskType={taskType} />}

      {/* Symbol toggle */}
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

      {/* Symbol palette */}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 5 }}>
              <TouchableOpacity
                onPress={() => setActiveGroup(-1)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor:
                    activeGroup === -1
                      ? colors.brand[500]
                      : isDark
                        ? "#27272a"
                        : "#e4e4e7",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: activeGroup === -1 ? "#fff" : theme.textSecondary,
                  }}
                >
                  Wszystkie
                </Text>
              </TouchableOpacity>
              {SYMBOL_GROUPS.map((g, gi) => (
                <TouchableOpacity
                  key={gi}
                  onPress={() => setActiveGroup(activeGroup === gi ? -1 : gi)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor:
                      activeGroup === gi
                        ? colors.brand[500]
                        : isDark
                          ? "#27272a"
                          : "#e4e4e7",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: activeGroup === gi ? "#fff" : theme.textSecondary,
                    }}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Symbole — filtrowane lub wszystkie */}
          {(activeGroup === -1
            ? SYMBOL_GROUPS
            : [SYMBOL_GROUPS[activeGroup]]
          ).map((group, gi) => (
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
                    onPress={() => insertSymbol(s.insert)}
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
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: theme.text,
                      }}
                    >
                      {s.label}
                    </Text>
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
        </View>
      )}

      {/* Single text input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onSelectionChange={(e) => {
          selectionRef.current = e.nativeEvent.selection;
        }}
        multiline
        placeholder={placeholder || "Zapisz obliczenia i wynik..."}
        placeholderTextColor={theme.textTertiary}
        style={{
          backgroundColor: theme.inputBg,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 16,
          padding: 14,
          fontSize: 15,
          fontFamily: "DMSans_400Regular",
          color: theme.text,
          textAlignVertical: "top",
          minHeight: 120,
        }}
      />
    </View>
  );
}
