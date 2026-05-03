// ============================================================================
// src/components/quiz/ReportQuestion.tsx
// "Zgłoś zadanie" — przycisk + modal (React Native)
// ============================================================================

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { createReport, ReportCategory } from "../../api/reports";

// ── Categories ────────────────────────────────────────────────────────────

const CATEGORIES: {
  id: ReportCategory;
  icon: string;
  label: string;
  desc: string;
}[] = [
  {
    id: "WRONG_ANSWER",
    icon: "❌",
    label: "Błędna odpowiedź",
    desc: "Poprawna odpowiedź jest inna niż wskazana",
  },
  {
    id: "CONTENT_ERROR",
    icon: "📝",
    label: "Błąd w treści",
    desc: "Literówka, błąd merytoryczny, złe dane",
  },
  {
    id: "UNCLEAR",
    icon: "❓",
    label: "Niejasne sformułowanie",
    desc: "Pytanie jest wieloznaczne lub niezrozumiałe",
  },
  {
    id: "MISSING_CONTENT",
    icon: "🖼️",
    label: "Brakujące dane",
    desc: "Brak obrazka, tabeli, kontekstu",
  },
  {
    id: "DISPLAY_BUG",
    icon: "🐛",
    label: "Problem z wyświetlaniem",
    desc: "Wzory lub layout się psuje",
  },
  {
    id: "OTHER",
    icon: "💬",
    label: "Inne",
    desc: "Inny problem",
  },
];

// ══════════════════════════════════════════════════════════════════════════
// ReportButton — mały przycisk w UI pytania
// ══════════════════════════════════════════════════════════════════════════

interface ReportButtonProps {
  questionId: string;
  questionPreview?: string;
}

export function ReportButton({
  questionId,
  questionPreview,
}: ReportButtonProps) {
  const [visible, setVisible] = useState(false);
  const { colors: theme } = useTheme();

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 10,
        }}
      >
        <Ionicons name="flag-outline" size={13} color={theme.textTertiary} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: "500",
            color: theme.textTertiary,
          }}
        >
          Zgłoś
        </Text>
      </TouchableOpacity>

      <ReportModal
        visible={visible}
        onClose={() => setVisible(false)}
        questionId={questionId}
        questionPreview={questionPreview}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ReportModal — pełny formularz zgłoszenia
// ══════════════════════════════════════════════════════════════════════════

function ReportModal({
  visible,
  onClose,
  questionId,
  questionPreview,
}: {
  visible: boolean;
  onClose: () => void;
  questionId: string;
  questionPreview?: string;
}) {
  const { colors: theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<ReportCategory | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const reset = () => {
    setCategory("");
    setDescription("");
    setSubmitting(false);
    setResult(null);
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(reset, 300);
  };

  const handleSubmit = useCallback(async () => {
    if (!category || description.trim().length < 5) return;
    setSubmitting(true);
    try {
      const res = await createReport({
        questionId,
        category,
        description: description.trim(),
      });
      setResult({ ok: true, message: res.message });
    } catch (err: any) {
      setResult({
        ok: false,
        message:
          err.message || "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [questionId, category, description]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: theme.background }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: Platform.OS === "ios" ? 16 : insets.top + 8,
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.borderLight,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.red[500] + "1A",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="warning" size={18} color={colors.red[500]} />
            </View>
            <View>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: theme.text,
                }}
              >
                Zgłoś problem
              </Text>
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                Pomóż nam poprawić jakość pytań
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.inputBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Result screen */}
        {result ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: result.ok
                  ? colors.brand[500] + "1A"
                  : colors.red[500] + "1A",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 36 }}>{result.ok ? "✅" : "⚠️"}</Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: result.ok ? colors.brand[600] : colors.red[600],
                textAlign: "center",
                lineHeight: 22,
                maxWidth: 280,
              }}
            >
              {result.message}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                marginTop: 28,
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: theme.inputBg,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: theme.textSecondary,
                }}
              >
                Zamknij
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              padding: 20,
              paddingBottom: insets.bottom + 100,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Question preview */}
            {questionPreview ? (
              <View
                style={{
                  backgroundColor: theme.inputBg,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: theme.textTertiary,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  Dotyczy pytania
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {questionPreview}
                </Text>
              </View>
            ) : null}

            {/* Category grid */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: theme.textSecondary,
                marginBottom: 10,
              }}
            >
              Rodzaj problemu
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {CATEGORIES.map((cat) => {
                const isActive = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={{
                      width: "48%",
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: isActive ? colors.red[400] : theme.border,
                      backgroundColor: isActive
                        ? colors.red[500] + "0D"
                        : theme.card,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 3,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: isActive ? colors.red[600] : theme.text,
                        }}
                      >
                        {cat.label}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: theme.textTertiary,
                        lineHeight: 14,
                      }}
                    >
                      {cat.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: theme.textSecondary,
                marginBottom: 8,
              }}
            >
              Opis problemu{" "}
              <Text style={{ fontWeight: "400", color: theme.textTertiary }}>
                (min. 5 znaków)
              </Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={2000}
              placeholder='Opisz co jest nie tak — np. "Poprawna odpowiedź to B, nie C, ponieważ..."'
              placeholderTextColor={theme.textTertiary}
              style={{
                backgroundColor: theme.inputBg,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 14,
                padding: 14,
                fontSize: 14,
                color: theme.text,
                minHeight: 120,
                textAlignVertical: "top",
                lineHeight: 21,
              }}
            />
            <Text
              style={{
                fontSize: 10,
                color: theme.textTertiary,
                textAlign: "right",
                marginTop: 4,
              }}
            >
              {description.length}/2000
            </Text>
          </ScrollView>
        )}

        {/* Submit bar (fixed at bottom) */}
        {!result && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: insets.bottom + 14,
              backgroundColor: theme.card,
              borderTopWidth: 1,
              borderTopColor: theme.borderLight,
            }}
          >
            <TouchableOpacity
              onPress={handleClose}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: theme.inputBg,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: theme.textSecondary,
                }}
              >
                Anuluj
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={
                !category || description.trim().length < 5 || submitting
              }
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: colors.red[500],
                alignItems: "center",
                opacity:
                  !category || description.trim().length < 5 || submitting
                    ? 0.4
                    : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                >
                  Wyślij zgłoszenie
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
