// ============================================================================
// AdminCopyButton — narzędzie diagnostyczne WYŁĄCZNIE dla administratora
// src/components/common/AdminCopyButton.tsx
//
// Kopiuje surowy JSON zadania/pytania albo identyfikator egzaminu do schowka.
// Powód istnienia: gdy uczeń zgłosi, że coś się źle renderuje albo źle ocenia,
// jedynym sposobem odtworzenia było ręczne szukanie rekordu w bazie po opisie
// z pamięci. Tutaj wystarczy jedno dotknięcie i wklejenie.
//
// Widoczność pilnowana jest po roli z KONTA (`user.role`), a nie po fladze w
// urządzeniu — konto bez uprawnień nie zobaczy przycisku nawet, gdy grzebie
// w apce. To i tak tylko wygoda: dane, które kopiuje, uczeń ma już w pamięci
// aplikacji, więc nie jest to bariera bezpieczeństwa, lecz odgracenie
// interfejsu zwykłemu użytkownikowi.
// ============================================================================

import React, { useState } from "react";
import { TouchableOpacity, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  /** Cokolwiek serializowalnego — obiekt leci przez JSON.stringify. */
  value: unknown;
  label: string;
  /** Skrócona etykieta po skopiowaniu (domyślnie „skopiowane"). */
  doneLabel?: string;
}

export function AdminCopyButton({ value, label, doneLabel = "skopiowane" }: Props) {
  const { user } = useAuth();
  const { colors: theme } = useTheme();
  const [done, setDone] = useState(false);

  if (user?.role !== "ADMIN") return null;

  const copy = async () => {
    const text =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    await Clipboard.setStringAsync(text);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <TouchableOpacity
      onPress={copy}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: done ? "#10b981" : theme.border,
        backgroundColor: done ? "#10b98118" : "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: done ? "#10b981" : theme.textTertiary,
        }}
      >
        {done ? `✓ ${doneLabel}` : label}
      </Text>
    </TouchableOpacity>
  );
}

/** Pozioma listwa na kilka przycisków — żeby nie rozpychać layoutu zadania. */
export function AdminCopyBar({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return null;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 8,
      }}
    >
      {children}
    </View>
  );
}
