// ============================================================================
// src/components/quiz/QuizReviewsPref.tsx
// „Powtórki w quizie" — przełącznik (hook + wiersz) i okienko „Dlaczego to
// pytanie wróciło?" otwierane z plakietki 🔁 Powtórka w QuizPlayScreen.
// Backend: GET /auth/me → quizReviews, PATCH /auth/study-prefs. Wyłączone =
// selektor nie dokłada powtórek (do 30% sesji), historia błędów zostaje.
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { setStudyPrefs } from "../../api/auth";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme";
import { Button } from "../ui/Button";

// Stan lokalny z optymistycznym przełączeniem i cofnięciem, gdy serwer nie
// przyjmie. Źródło prawdy: /me (brak pola = włączone, jak domyślnie w bazie).
export function useQuizReviewsPref() {
  const { user, refresh } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(user?.quizReviews ?? true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setEnabled(user?.quizReviews ?? true);
  }, [user?.quizReviews]);
  const toggle = async () => {
    if (saving) return;
    const want = !enabled;
    setEnabled(want);
    setSaving(true);
    try {
      const res = await setStudyPrefs({ quizReviews: want });
      setEnabled(res?.quizReviews ?? want);
      refresh().catch(() => {});
    } catch {
      setEnabled(!want); // serwer nie przyjął — wróć do stanu faktycznego
    } finally {
      setSaving(false);
    }
  };
  return { enabled, saving, toggle };
}

// Ten sam wygląd przełącznika co „Tryb ciemny" i zgoda w Profilu.
export function TogglePill({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        backgroundColor: on ? colors.brand[500] : colors.zinc[300],
        justifyContent: "center",
        paddingHorizontal: 3,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#fff",
          alignSelf: on ? "flex-end" : "flex-start",
        }}
      />
    </View>
  );
}

export const QUIZ_REVIEWS_OFF_NOTE =
  "Wyłączone: quiz będzie dobierał tylko nowe pytania. Twoje błędy dalej są zapamiętywane — po ponownym włączeniu powtórki wrócą. Działa od następnej sesji, w aplikacji i na webie.";

export function QuizReviewsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors: theme } = useTheme();
  const { enabled, saving, toggle } = useQuizReviewsPref();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 20,
            gap: 14,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }}>
            Dlaczego to pytanie wróciło?
          </Text>
          <Text
            style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}
          >
            To pytanie sprawiło Ci wcześniej trudność, więc quiz podsuwa je
            ponownie po kilku dniach — powtórki w odstępach najlepiej utrwalają
            materiał. Zajmują najwyżej 30% sesji.
          </Text>

          <TouchableOpacity
            onPress={toggle}
            disabled={saving}
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled, disabled: saving }}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              paddingVertical: spacing[3],
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: theme.borderLight,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
            >
              <Ionicons name="repeat" size={20} color={theme.textSecondary} />
              <Text style={{ fontSize: 15, fontWeight: "500", color: theme.text }}>
                Powtórki w quizie
              </Text>
            </View>
            <TogglePill on={enabled} />
          </TouchableOpacity>

          {!enabled && (
            <Text
              style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}
            >
              {QUIZ_REVIEWS_OFF_NOTE}
            </Text>
          )}

          <Text style={{ fontSize: 11, color: theme.textTertiary }}>
            Zmienisz to też w Profilu.
          </Text>

          <Button title="Zamknij" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}
