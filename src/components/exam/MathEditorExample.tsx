// ============================================================================
// MathEditorExample — Mobile: shows unicode-based examples
// ============================================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

interface Props {
  taskType?: string;
}

const EXAMPLES: Record<string, { title: string; lines: string[] }> = {
  default: {
    title: "Przykład odpowiedzi",
    lines: [
      "Obliczam deltę:",
      "Δ = b² - 4·a·c = (-2)² - 4·1·(-8) = 4 + 32 = 36",
      "√Δ = 6",
      "x₁ = (2 + 6) / 2 = 4",
      "x₂ = (2 - 6) / 2 = -2",
      "Odp: x ∈ ⟨-2, 4⟩",
    ],
  },
  math_short_calc: {
    title: "Przykład krótkiego obliczenia",
    lines: ["P = π·r² = π·5² = 25π ≈ 78,54 cm²"],
  },
  math_extended_calc: {
    title: "Przykład rozszerzonego obliczenia",
    lines: [
      "Dane: a = 3, b = 4",
      "c = √(a² + b²) = √(9 + 16) = √25 = 5",
      "P = ½·a·b = ½·3·4 = 6",
      "Odp: c = 5, P = 6",
    ],
  },
  math_proof: {
    title: "Przykład dowodu",
    lines: [
      "Załóżmy, że n jest parzyste, tj. n = 2k",
      "Wtedy n² = (2k)² = 4k² = 2·(2k²)",
      "Ponieważ 2k² ∈ ℤ, to n² jest parzyste",
      "∴ Q.E.D.",
    ],
  },
};

export function MathEditorExample({ taskType }: Props) {
  const { colors: theme, isDark } = useTheme();
  const [open, setOpen] = useState(false);

  const example = EXAMPLES[taskType || ""] || EXAMPLES.default;

  return (
    <View style={{ marginBottom: 10 }}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 12,
          backgroundColor: isDark ? "#0c4a6e15" : "#f0f9ff",
          borderWidth: 1,
          borderColor: isDark ? "#0c4a6e40" : "#bae6fd",
          alignSelf: "flex-start",
        }}
      >
        <Ionicons
          name="help-circle-outline"
          size={14}
          color={isDark ? "#38bdf8" : "#0284c7"}
        />
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: isDark ? "#38bdf8" : "#0284c7",
          }}
        >
          Jak odpowiadać?
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={10}
          color={isDark ? "#38bdf8" : "#0284c7"}
        />
      </TouchableOpacity>

      {open && (
        <View
          style={{
            marginTop: 8,
            padding: 14,
            borderRadius: 14,
            backgroundColor: isDark ? "#0c4a6e10" : "#f0f9ff",
            borderWidth: 1,
            borderColor: isDark ? "#0c4a6e30" : "#bae6fd",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: isDark ? "#38bdf8" : "#0284c7",
              marginBottom: 8,
            }}
          >
            {example.title}
          </Text>

          <View
            style={{
              backgroundColor: isDark ? "#0a0a1f" : "#fff",
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: isDark ? "#1e3a5f" : "#e0f2fe",
            }}
          >
            {example.lines.map((line, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 13,
                  fontFamily: "JetBrainsMono_400Regular",
                  color: isDark ? "#bae6fd" : "#0c4a6e",
                  lineHeight: 22,
                }}
              >
                {line}
              </Text>
            ))}
          </View>

          <View style={{ marginTop: 10, gap: 6 }}>
            <Text
              style={{
                fontSize: 11,
                color: theme.textSecondary,
                lineHeight: 17,
              }}
            >
              📝 Pisz normalnie klawiaturą, a specjalne symbole (², √, π, ≤)
              wstawiaj przyciskiem{" "}
              <Text style={{ fontWeight: "700" }}>∑ Symbole</Text> powyżej.
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: theme.textSecondary,
                lineHeight: 17,
              }}
            >
              💡 AI rozumie zapis tekstowy — nie musisz formatować wzorów
              idealnie.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
