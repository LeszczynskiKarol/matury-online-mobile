// ============================================================================
// AdminExamList — pełna lista arkuszy z akcjami, wyłącznie dla administratora
// src/components/exam/AdminExamList.tsx
//
// Odpowiednik zakładki „Arkusze" z panelu na stronie. Powód istnienia: widok
// ucznia pokazuje wyłącznie arkusze dostępne DLA NIEGO — aktywne, jeszcze nie
// rozwiązane, przefiltrowane przez ofertę próbną. Przy sprawdzaniu zgłoszenia
// („zadanie 4 w niemieckim PR jest zepsute") nie było stąd żadnej drogi do
// wskazanego arkusza, bo zepsute arkusze zwykle są już zdezaktywowane.
//
// Te same akcje co na stronie: aktywacja, dorysowanie grafik, oznaczenie jako
// sprawdzony, zerowanie własnych podejść, usunięcie i wejście w arkusz.
// Widoczność pilnuje rola z konta (`user.role`), nie flaga w urządzeniu.
// ============================================================================

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
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
  maxPoints?: number;
  timeMinutes?: number;
  attemptCount?: number;
  avgScore?: number | null;
  reviewedByAdmin?: boolean;
  createdAt?: string;
  generatedAt?: string | null;
  subject?: { id?: string; name?: string; slug?: string; icon?: string };
  subjectId?: string;
}

interface Props {
  /** Wejście w arkusz — ten sam ekran, co przy zwykłym starcie egzaminu. */
  onOpen: (examId: string) => void;
}

type LevelFilter = "all" | "PODSTAWOWY" | "ROZSZERZONY";
type ActiveFilter = "all" | "active" | "inactive";

export function AdminExamList({ onOpen }: Props) {
  const { user } = useAuth();
  const { colors: theme } = useTheme();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [activeOnly, setActiveOnly] = useState<ActiveFilter>("all");
  const [subject, setSubject] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Lista bywa długa, a ekran wyboru egzaminu otwiera się przy każdym wejściu
  // w zakładkę — dlatego ładujemy dopiero po rozwinięciu.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ exams?: AdminExam[] } | AdminExam[]>(
        "/admin/exams?limit=300",
      );
      setExams(Array.isArray(res) ? res : (res?.exams ?? []));
    } catch (e: any) {
      setError(e?.message || "Nie udało się pobrać listy arkuszy.");
    } finally {
      setLoading(false);
    }
  }, []);

  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of exams) {
      const name = e.subject?.name || e.subjectId;
      if (name) map.set(name, e.subject?.icon || "📄");
    }
    return Array.from(map.entries());
  }, [exams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter((e) => {
      if (level !== "all" && e.level !== level) return false;
      if (activeOnly === "active" && !e.isActive) return false;
      if (activeOnly === "inactive" && e.isActive) return false;
      if (subject !== "all" && (e.subject?.name || e.subjectId) !== subject)
        return false;
      if (!q) return true;
      return (
        e.title?.toLowerCase().includes(q) ||
        e.subject?.name?.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    });
  }, [exams, query, level, activeOnly, subject]);

  if (user?.role !== "ADMIN") return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && exams.length === 0 && !loading) void load();
  };

  const patchLocal = (id: string, patch: Partial<AdminExam>) =>
    setExams((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const copyId = async (id: string) => {
    await Clipboard.setStringAsync(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const run = async (
    id: string,
    label: string,
    fn: () => Promise<void>,
  ): Promise<void> => {
    setBusy(id + label);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert("Nie udało się", e?.message || "Spróbuj ponownie.");
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = (e: AdminExam) =>
    run(e.id, "active", async () => {
      const res = await api<{ isActive?: boolean }>(`/admin/exams/${e.id}`, {
        method: "PATCH",
        body: { isActive: !e.isActive },
      });
      patchLocal(e.id, { isActive: res?.isActive ?? !e.isActive });
    });

  const toggleReviewed = (e: AdminExam) =>
    run(e.id, "review", async () => {
      await api(`/admin/exams/${e.id}/review`, { method: "POST" });
      patchLocal(e.id, { reviewedByAdmin: !e.reviewedByAdmin });
    });

  const generateVisuals = (e: AdminExam) =>
    run(e.id, "visuals", async () => {
      await api(`/admin/exams/${e.id}/generate-visuals`, { method: "POST" });
      Alert.alert("Gotowe", "Brakujące schematy zostały dorysowane.");
    });

  const resetMine = (e: AdminExam) =>
    Alert.alert(
      "Wyzerować Twoje podejścia?",
      `Arkusz „${e.title}" pojawi się znów jako nierozwiązany. Dotyczy tylko Twojego konta.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Wyzeruj",
          style: "destructive",
          onPress: () =>
            void run(e.id, "reset", async () => {
              await api(`/admin/exams/${e.id}/reset-my-attempts`, {
                method: "POST",
              });
              patchLocal(e.id, { attemptCount: 0 });
            }),
        },
      ],
    );

  const remove = (e: AdminExam) =>
    Alert.alert(
      "Usunąć arkusz?",
      `„${e.title}" zniknie razem z podejściami uczniów. Tego nie da się cofnąć.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: () =>
            void run(e.id, "delete", async () => {
              await api(`/admin/exams/${e.id}`, { method: "DELETE" });
              setExams((prev) => prev.filter((x) => x.id !== e.id));
            }),
        },
      ],
    );

  const resetAllMine = () =>
    Alert.alert(
      "Wyzerować wszystkie Twoje podejścia?",
      "Wszystkie arkusze ze wszystkich przedmiotów pojawią się znów jako dostępne.",
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Wyzeruj",
          style: "destructive",
          onPress: () =>
            void run("all", "reset", async () => {
              await api("/admin/exams/reset-all-my-attempts", {
                method: "POST",
              });
              await load();
            }),
        },
      ],
    );

  // ── drobne elementy UI ────────────────────────────────────────────────────
  const Chip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.brand[500] : theme.cardBorder,
        backgroundColor: active ? colors.brand[500] + "1A" : "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: active ? colors.brand[500] : theme.textTertiary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const Action = ({
    label,
    onPress,
    tone = "neutral",
    disabled,
  }: {
    label: string;
    onPress: () => void;
    tone?: "neutral" | "brand" | "warn" | "danger";
    disabled?: boolean;
  }) => {
    const tint =
      tone === "brand"
        ? colors.brand[500]
        : tone === "warn"
          ? "#f59e0b"
          : tone === "danger"
            ? colors.red[500]
            : theme.textSecondary;
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={{
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: tint + "55",
          backgroundColor: tint + "12",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: "700", color: tint }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
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
          Arkusze — wszystkie{exams.length > 0 ? ` (${exams.length})` : ""}
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
                  marginBottom: 8,
                }}
              />

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <Chip
                  label="Wszystkie"
                  active={level === "all" && activeOnly === "all"}
                  onPress={() => {
                    setLevel("all");
                    setActiveOnly("all");
                  }}
                />
                <Chip
                  label="PP"
                  active={level === "PODSTAWOWY"}
                  onPress={() =>
                    setLevel(level === "PODSTAWOWY" ? "all" : "PODSTAWOWY")
                  }
                />
                <Chip
                  label="PR"
                  active={level === "ROZSZERZONY"}
                  onPress={() =>
                    setLevel(level === "ROZSZERZONY" ? "all" : "ROZSZERZONY")
                  }
                />
                <Chip
                  label="Aktywne"
                  active={activeOnly === "active"}
                  onPress={() =>
                    setActiveOnly(activeOnly === "active" ? "all" : "active")
                  }
                />
                <Chip
                  label="Nieaktywne"
                  active={activeOnly === "inactive"}
                  onPress={() =>
                    setActiveOnly(activeOnly === "inactive" ? "all" : "inactive")
                  }
                />
              </View>

              {subjects.length > 1 && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <Chip
                    label="Wszystkie przedmioty"
                    active={subject === "all"}
                    onPress={() => setSubject("all")}
                  />
                  {subjects.map(([name, icon]) => (
                    <Chip
                      key={name}
                      label={`${icon} ${name}`}
                      active={subject === name}
                      onPress={() =>
                        setSubject(subject === name ? "all" : name)
                      }
                    />
                  ))}
                </View>
              )}

              <TouchableOpacity
                onPress={resetAllMine}
                style={{ alignSelf: "flex-start", marginBottom: 8 }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: "#8b5cf6",
                  }}
                >
                  🔄 Wyzeruj wszystkie moje podejścia
                </Text>
              </TouchableOpacity>

              <Text
                style={{
                  fontSize: 10,
                  color: theme.textTertiary,
                  marginBottom: 4,
                }}
              >
                {filtered.length} z {exams.length}
              </Text>

              {filtered.slice(0, 60).map((e) => (
                <View
                  key={e.id}
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
                        backgroundColor: e.isActive
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
                      {e.title}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                      {e.level === "ROZSZERZONY" ? "PR" : "PP"}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 10,
                      color: theme.textTertiary,
                      marginTop: 3,
                    }}
                  >
                    {e.subject?.name || e.subjectId || "—"}
                    {e.maxPoints ? ` · ${e.maxPoints} pkt` : ""}
                    {e.timeMinutes ? ` · ${e.timeMinutes} min` : ""}
                    {typeof e.attemptCount === "number"
                      ? ` · ${e.attemptCount} podejść`
                      : ""}
                    {typeof e.avgScore === "number"
                      ? ` · śr. ${Math.round(e.avgScore)}%`
                      : ""}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => copyId(e.id)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor:
                          copiedId === e.id ? "#10b981" : theme.cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color:
                            copiedId === e.id ? "#10b981" : theme.textTertiary,
                        }}
                      >
                        {copiedId === e.id
                          ? "✓ ID skopiowane"
                          : `⧉ …${e.id.slice(-8)}`}
                      </Text>
                    </TouchableOpacity>

                    <Action
                      label="Otwórz →"
                      tone="brand"
                      onPress={() => onOpen(e.id)}
                    />
                    <Action
                      label={
                        busy === e.id + "active"
                          ? "…"
                          : e.isActive
                            ? "Deaktywuj"
                            : "Aktywuj"
                      }
                      tone="warn"
                      disabled={busy === e.id + "active"}
                      onPress={() => void toggleActive(e)}
                    />
                    <Action
                      label={
                        busy === e.id + "visuals" ? "Rysuję…" : "Grafiki"
                      }
                      disabled={busy === e.id + "visuals"}
                      onPress={() => void generateVisuals(e)}
                    />
                    <Action
                      label={e.reviewedByAdmin ? "✅ Sprawdzony" : "⬜ Sprawdź"}
                      disabled={busy === e.id + "review"}
                      onPress={() => void toggleReviewed(e)}
                    />
                    <Action
                      label="🔄 Moje podejścia"
                      disabled={busy === e.id + "reset"}
                      onPress={() => resetMine(e)}
                    />
                    <Action
                      label="Usuń"
                      tone="danger"
                      disabled={busy === e.id + "delete"}
                      onPress={() => remove(e)}
                    />
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
                  Pokazane 60 z {filtered.length} — zawęź filtrem lub
                  wyszukiwaniem.
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}
