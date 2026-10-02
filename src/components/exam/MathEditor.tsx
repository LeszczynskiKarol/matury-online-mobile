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
import { ClearableTextInput } from "../ui/ClearAnswerButton";
import { SymbolPalette } from "./SymbolPalette";

interface MathEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  taskType?: string;
  showExample?: boolean;
  /**
   * Plain mode dla humanistycznych zadań (wos/hist/polski/geo otwarte):
   * ukrywa hint "Jak odpowiadać" + paletę symboli matematycznych.
   * Zostawia sam textarea + word counter.
   */
  plain?: boolean;
}

// Paleta symboli (unicode) — wspólna z paskiem dla małych pól: SymbolPalette.

export function MathEditor({
  value,
  onChange,
  placeholder,
  taskType,
  showExample = true,
  plain = false,
}: MathEditorProps) {
  const { colors: theme, isDark } = useTheme();
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
      {!plain && showExample && <MathEditorExample taskType={taskType} />}

      {/* Symbol palette (hidden in plain mode) */}
      {!plain && <SymbolPalette onInsert={insertSymbol} />}

      {/* Single text input */}
      <ClearableTextInput autoComplete="off" importantForAutofill="no" textContentType="none"
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
