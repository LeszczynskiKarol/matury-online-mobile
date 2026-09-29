// ============================================================================
// ClearAnswerButton — „✕” czyszczący odpowiedź + „Wyczyszczono · Cofnij”
// src/components/ui/ClearAnswerButton.tsx (kopiowany 1:1 między apkami)
//
//  • ClearableTextInput — zamiennik <TextInput> z tymi samymi propsami.
//    Czyszczenie i Cofnij wołają ZWYKŁE onChangeText rodzica, więc idą tą samą
//    ścieżką zapisu (stan → autosave arkusza), co pisanie.
//  • ClearAnswerButton + useClearWithUndo — dla pól, gdzie wrapper nie pasuje.
//
// Zasady (jak na webie, zatwierdzone przez Karola 29.09.2026):
//  • ✕ widać tylko przy niepustym, edytowalnym polu; cel dotyku ≥ 40 dp,
//  • klik czyści od razu (bez potwierdzenia), snackbar na 8 s,
//  • Cofnij przywraca dokładnie poprzedni tekst, kursor na końcu,
//  • cofnąć można tylko ostatnie czyszczenie,
//  • gdy uczeń zacznie pisać po wyczyszczeniu, snackbar znika (Cofnij nie
//    nadpisze nowego tekstu); tak samo przy odmontowaniu pola.
// ============================================================================

import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { dismissUndoSnackbar, showUndoSnackbar } from "./UndoSnackbar";

export const CLEAR_LABEL = "Wyczyść odpowiedź";

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
  const [owner] = useState(() => Symbol("clear-answer"));
  const saved = useRef<string | null>(null);
  const latest = useRef({ value, setValue, focus });
  latest.current = { value, setValue, focus };

  useEffect(() => {
    if (saved.current !== null && value !== "") {
      saved.current = null;
      dismissUndoSnackbar(owner);
    }
  }, [value, owner]);

  useEffect(() => () => dismissUndoSnackbar(owner), [owner]);

  const clear = useCallback(() => {
    const prev = latest.current.value;
    if (!prev) return;
    saved.current = prev;
    latest.current.setValue("");
    showUndoSnackbar(owner, "Wyczyszczono", () => {
      const text = saved.current;
      saved.current = null;
      if (text === null) return;
      latest.current.setValue(text);
      setTimeout(() => latest.current.focus?.(text.length), 50);
    });
  }, [owner]);

  return { clear, canClear: value.length > 0 };
}

export function ClearAnswerButton({
  onClear,
  style,
}: {
  onClear: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: theme } = useTheme();
  return (
    <Pressable
      onPress={onClear}
      accessibilityRole="button"
      accessibilityLabel={CLEAR_LABEL}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Ionicons name="close" size={18} color={theme.textTertiary} />
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
  const { clear, canClear } = useClearWithUndo({
    value,
    setValue: (v) => rest.onChangeText?.(v),
    focus: (len) => {
      inner.current?.focus();
      inner.current?.setSelection?.(len, len);
    },
  });
  const show = canClear && rest.editable !== false && !!rest.onChangeText;
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
        <ClearAnswerButton
          onClear={clear}
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
