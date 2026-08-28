// ============================================================================
// AdminExamList — pełna lista arkuszy, widoczna wyłącznie dla administratora
// src/components/exam/AdminExamList.tsx
//
// Widok ucznia celowo pokazuje tylko arkusze dostępne DLA NIEGO: bez
// nieaktywnych, bez już rozwiązanych, przefiltrowane przez ofertę próbną.
// Przy sprawdzaniu zgłoszenia („zadanie 4 w niemieckim PR jest zepsute")
// oznacza to, że z poziomu apki nie da się wejść we wskazany arkusz.
//
// Ta lista pokazuje wszystko, co jest w bazie, z identyfikatorem do skopiowania
// i wejściem wprost do arkusza — także nieaktywnego, bo właśnie takie trafiają
// do poprawki. Odpowiednik zakładki „Arkusze" w panelu na stronie.
// ============================================================================

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../api/client";
import { radius } from "../../theme";
import { colors } from "../../theme/colors";

interface AdminExam {
  id: string;
  title: string;
  level: string;
  isActive: boolean;
  status?: string;
  subject?: { name?: string; slug?: string; icon?: string };
  subjectId?: string;
}

interface Props {
  /** Wejście w arkusz — ten sam ekran, co przy zwykłym starcie egzaminu. */
  onOpen: (examId: string) => void;
}

export function AdminExamList({ onOpen }: Props) {
  const { user } = useAuth();
  const { colors: theme } = useTheme();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lista bywa długa (kilkaset arkuszy), więc ładujemy ją dopiero przy
  // rozwinięciu — ekran wyboru egzaminu otwiera się przy każdym wejściu
  // w zakładkę i nie ma powodu ciągnąć jej za każdym razem.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ exams?: AdminExam[] } | AdminExam[]>(
        "/admin/exams?limit=300",
      );
      const list = Array.isArray(res) ? res : (res?.exams ?? []);
      setExams(list);
    } catch (e: any) {
      setError(e?.message || "Nie udało się pobrać listy arkuszy.");
    } finally {
      setLoading(false);
    }
  }, []);

  if (user?.role !== "ADMIN") return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && exams.length === 0 && !loading) void load();
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? exams.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.subject?.name?.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q),
      )
    : exams;

  const copyId = async (id: string) => {
    await Clipboard.setStringAsync(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <View
      style={{
        marginTop: 20,
        borderRadius: radius["2xl"],
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: theme.cardBorder,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={toggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Text style={{ fontSize: 14 }}>📄</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
          Arkusze — wszystkie
          {exams.length > 0 ? ` (${exams.length})` : ""}
        </Text>
        <Text
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: theme.textTertiary,
          }}
        >
          {open ? "zwiń ▲" : "tylko admin ▼"}
        </Text>
      </TouchableOpacity>

      {open && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.cardBorder,
            padding: 12,
          }}
        >
          {loading && (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator color={colors.brand[500]} />
            </View>
          )}

          {error && (
            <View style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 12, color: colors.red[500] }}>
                {error}
              </Text>
              <TouchableOpacity onPress={load} style={{ marginTop: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.brand[500],
                  }}
                >
                  Spróbuj ponownie
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && exams.length > 0 && (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Szukaj: tytuł, przedmiot lub ID"
                placeholderTextColor={theme.textTertiary}
                style={{
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  borderRadius: radius.xl,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 10,
                }}
              />

              {filtered.length === 0 && (
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                  Nic nie pasuje do „{query}".
                </Text>
              )}

              {filtered.slice(0, 60).map((exam) => (
                <View
                  key={exam.id}
                  style={{
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderTopColor: theme.cardBorder,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: exam.isActive
                          ? "#10b981"
                          : theme.textTertiary,
                      }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight: "600",
                        color: theme.text,
                      }}
                    >
                      {exam.title}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                      {exam.level === "ROZSZERZONY" ? "PR" : "PP"}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                      {exam.subject?.name || exam.subjectId || "—"}
                    </Text>

                    <TouchableOpacity
                      onPress={() => copyId(exam.id)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor:
                          copiedId === exam.id ? "#10b981" : theme.cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color:
                            copiedId === exam.id
                              ? "#10b981"
                              : theme.textTertiary,
                        }}
                      >
                        {copiedId === exam.id
                          ? "✓ ID skopiowane"
                          : `⧉ …${exam.id.slice(-8)}`}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onOpen(exam.id)}
                      style={{
                        marginLeft: "auto",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: colors.brand[500],
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: "#fff",
                        }}
                      >
                        Otwórz →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {filtered.length > 60 && (
                <Text
                  style={{
                    fontSize: 10,
                    color: theme.textTertiary,
                    marginTop: 10,
                  }}
                >
                  Pokazane 60 z {filtered.length} — zawęź wyszukiwaniem.
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}
