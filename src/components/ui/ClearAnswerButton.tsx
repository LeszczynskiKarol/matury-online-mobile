// ============================================================================
// ClearAnswerButton — „✕” czyszczący odpowiedź, w tym samym miejscu „↶ Cofnij”
// src/components/ui/ClearAnswerButton.tsx (kopiowany 1:1 między apkami)
//
//  • ClearableTextInput — zamiennik <TextInput> z tymi samymi propsami.
//    Czyszczenie i Cofnij wołają ZWYKŁE onChangeText rodzica, więc idą tą samą
//    ścieżką zapisu (stan → autosave arkusza), co pisanie.
//  • ClearUndoButton + useClearWithUndo — dla pól, gdzie wrapper nie pasuje.
//
// Zasady (jak na webie, zatwierdzone przez Karola 29.09.2026):
//  • ✕ widać tylko przy niepustym, edytowalnym polu; cel dotyku ≥ 40 dp,
//  • klik czyści od razu (bez potwierdzenia); w miejscu ✕ przez 8 s stoi
//    „↶ Cofnij” (bez paska na dole — zasłaniał nawigację),
//  • Cofnij przywraca dokładnie poprzedni tekst, kursor na końcu,
//  • gdy uczeń zacznie pisać po wyczyszczeniu, „Cofnij” znika (nie nadpisze
//    nowego tekstu); przy odmontowaniu pola znika razem z nim.
// ============================================================================

import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

export const CLEAR_LABEL = "Wyczyść odpowiedź";
export const UNDO_LABEL = "Cofnij wyczyszczenie";
const UNDO_MS = 8000;

export function useClearWithUndo({
  value,
  setValue,
  focus,
}: {
  value: string;
  setValue: (v: string) => void;
  /** Po Cofnij: fokus + kursor na końcu. */
  focus?: (len: number) => void;
}) {
  const [saved, setSaved] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ value, setValue, focus });
  latest.current = { value, setValue, focus };

  const drop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSaved(null);
  }, []);

  // Uczeń pisze coś nowego po wyczyszczeniu → „Cofnij” znika.
  useEffect(() => {
    if (saved !== null && value !== "") drop();
  }, [value, saved, drop]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const clear = useCallback(() => {
    const prev = latest.current.value;
    if (!prev) return;
    setSaved(prev);
    latest.current.setValue("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(null), UNDO_MS);
  }, []);

  const undo = useCallback(() => {
    const text = saved;
    drop();
    if (text === null) return;
    latest.current.setValue(text);
    setTimeout(() => latest.current.focus?.(text.length), 50);
  }, [saved, drop]);

  return { clear, undo, canClear: value.length > 0, canUndo: saved !== null };
}

/**
 * ✕ czyści, a po kliknięciu — w tym samym miejscu — przez 8 s stoi ↶ „Cofnij”
 * (Karol 29.09.2026: cofanie tam, gdzie się kliknęło, bez paska na dole).
 */
export function ClearUndoButton({
  ctl,
  style,
}: {
  ctl: { clear: () => void; undo: () => void; canClear: boolean; canUndo: boolean };
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: theme } = useTheme();
  const undoMode = ctl.canUndo;
  if (!undoMode && !ctl.canClear) return null;
  return (
    <Pressable
      onPress={undoMode ? ctl.undo : ctl.clear}
      accessibilityRole="button"
      accessibilityLabel={undoMode ? UNDO_LABEL : CLEAR_LABEL}
      hitSlop={6}
      style={({ pressed }) => [
        {
          minWidth: 40,
          height: 40,
          paddingHorizontal: undoMode ? 10 : 0,
          borderRadius: 20,
          flexDirection: "row",
          gap: 4,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.5 : 1,
        },
        style,
      ]}
    >
      {undoMode ? (
        <>
          <Ionicons name="arrow-undo" size={16} color={colors.brand[500]} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.brand[500] }}>Cofnij</Text>
        </>
      ) : (
        <Ionicons name="close" size={18} color={theme.textTertiary} />
      )}
    </Pressable>
  );
}

type Props = TextInputProps & {
  /** Styl zewnętrznego View (np. flex: 1 w wierszu). */
  containerStyle?: StyleProp<ViewStyle>;
};

export const ClearableTextInput = forwardRef<TextInput, Props>(function ClearableTextInput(
  { containerStyle, style, ...rest },
  ref,
) {
  const inner = useRef<TextInput | null>(null);
  const value = typeof rest.value === "string" ? rest.value : "";
  const ctl = useClearWithUndo({
    value,
    setValue: (v) => rest.onChangeText?.(v),
    focus: (len) => {
      inner.current?.focus();
      inner.current?.setSelection?.(len, len);
    },
  });
  const show = rest.editable !== false && !!rest.onChangeText;
  return (
    <View style={[{ position: "relative" }, containerStyle]}>
      <TextInput
        {...rest}
        ref={(node) => {
          inner.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        // Stały odstęp z prawej — tekst nie wchodzi pod ✕ i nie przeskakuje.
        style={[style, { paddingRight: 44 }]}
      />
      {show && (
        <ClearUndoButton
          ctl={ctl}
          style={
            rest.multiline
              ? { position: "absolute", top: 2, right: 2 }
              : { position: "absolute", top: "50%", marginTop: -20, right: 2 }
          }
        />
      )}
    </View>
  );
});
