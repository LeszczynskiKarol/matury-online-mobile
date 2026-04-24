// ============================================================================
// Quiz Setup Screen — matches web SessionSetup exactly
// CHANGED: navigation.navigate now passes subjectId + questionTypes
// ============================================================================

import React, { useCallback, useState } from "react";
import { getDashboard } from "../../api/sessions";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { subjectsApi } from "../../api";
import { createSession } from "../../api/sessions";
import { getQuestions } from "../../api/questions";
import type { Subject } from "../../api/subjects";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import type { QuizStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<QuizStackParamList>;

interface SessionCategory {
  label: string;
  icon: string;
  types: string[];
  desc: string;
}

const SUBJECT_CATEGORIES: Record<string, SessionCategory[]> = {
  informatyka: [
    {
      label: "Zadania otwarte",
      icon: "✏️",
      types: ["OPEN"],
      desc: "Algorytmy, pseudokod, wyjaśnienia",
    },
    {
      label: "Testy zamknięte",
      icon: "🔘",
      types: ["CLOSED", "MULTI_SELECT", "TRUE_FALSE", "FILL_IN", "MATCHING"],
      desc: "Zamknięte, uzupełnianie, dopasowania",
    },
    {
      label: "Obliczenia",
      icon: "🧮",
      types: ["CALCULATION"],
      desc: "Systemy liczbowe, złożoność, obliczenia",
    },
    {
      label: "Dane i wykresy",
      icon: "📊",
      types: ["TABLE_DATA", "GRAPH_INTERPRET"],
      desc: "Tabele, wykresy, analiza danych",
    },
  ],
  matematyka: [
    {
      label: "Zadania otwarte",
      icon: "✏️",
      types: ["OPEN"],
      desc: "Rozwiązania z pełnym zapisem",
    },
    {
      label: "Testy zamknięte",
      icon: "🔘",
      types: ["CLOSED", "MULTI_SELECT", "TRUE_FALSE", "FILL_IN"],
      desc: "Zadania z odpowiedziami ABCD",
    },
    {
      label: "Wykresy i tabele",
      icon: "📊",
      types: ["GRAPH_INTERPRET", "TABLE_DATA"],
      desc: "Odczytywanie danych, interpretacja",
    },
    {
      label: "Dowody i kolejność",
      icon: "🧮",
      types: ["PROOF_ORDER", "ORDERING", "ERROR_FIND"],
      desc: "Dowodzenie, porządkowanie kroków",
    },
  ],
  biologia: [
    {
      label: "Zadania otwarte",
      icon: "✏️",
      types: ["OPEN", "EXPERIMENT_DESIGN"],
      desc: "Opisy, projekty doświadczeń",
    },
    {
      label: "Testy zamknięte",
      icon: "🔘",
      types: ["CLOSED", "MULTI_SELECT", "TRUE_FALSE", "FILL_IN", "MATCHING"],
      desc: "Zamknięte, dopasowania",
    },
    {
      label: "Schematy i obliczenia",
      icon: "🧬",
      types: ["DIAGRAM_LABEL", "CROSS_PUNNETT", "CALCULATION"],
      desc: "Krzyżówki, schematy, rachunki",
    },
    {
      label: "Materiały źródłowe",
      icon: "📊",
      types: ["WIAZKA", "TABLE_DATA", "GRAPH_INTERPRET"],
      desc: "Tabele, wykresy, analiza danych",
    },
  ],
  chemia: [
    {
      label: "Zadania otwarte",
      icon: "✏️",
      types: ["OPEN", "CALCULATION"],
      desc: "Obliczenia, reakcje, wyprowadzenia",
    },
    {
      label: "Testy zamknięte",
      icon: "🔘",
      types: ["CLOSED", "MULTI_SELECT", "TRUE_FALSE", "FILL_IN", "MATCHING"],
      desc: "Zamknięte, uzupełnianie",
    },
    {
      label: "Materiały źródłowe",
      icon: "📊",
      types: ["WIAZKA", "TABLE_DATA", "GRAPH_INTERPRET"],
      desc: "Tabele, wykresy, dane doświadczalne",
    },
  ],
  fizyka: [
    {
      label: "Zadania otwarte",
      icon: "✏️",
      types: ["OPEN", "CALCULATION"],
      desc: "Obliczenia, wyprowadzenia wzorów",
    },
    {
      label: "Testy zamknięte",
      icon: "🔘",
      types: ["CLOSED", "MULTI_SELECT", "TRUE_FALSE", "FILL_IN"],
      desc: "Zamknięte, prawda/fałsz",
    },
    {
      label: "Wykresy i dane",
      icon: "📊",
      types: ["GRAPH_INTERPRET", "TABLE_DATA", "WIAZKA"],
      desc: "Interpretacja wykresów i tabel",
    },
  ],
  polski: [
    {
      label: "Pisanie",
      icon: "✏️",
      types: ["OPEN", "ESSAY"],
      desc: "Pytania otwarte i wypracowania",
    },
    {
      label: "Testy i quizy",
      icon: "🔘",
      types: [
        "CLOSED",
        "MULTI_SELECT",
        "TRUE_FALSE",
        "FILL_IN",
        "MATCHING",
        "ORDERING",
        "ERROR_FIND",
        "CLOZE",
      ],
      desc: "Zamknięte, wyboru, łączenia, błędy",
    },
    {
      label: "Praca z tekstem",
      icon: "📄",
      types: ["WIAZKA"],
      desc: "Analiza fragmentów tekstów",
    },
  ],
  angielski: [
    {
      label: "Pisanie",
      icon: "✏️",
      types: ["OPEN", "ESSAY"],
      desc: "Pytania otwarte i wypracowania",
    },
    {
      label: "Testy i quizy",
      icon: "🔘",
      types: [
        "CLOSED",
        "MULTI_SELECT",
        "TRUE_FALSE",
        "FILL_IN",
        "MATCHING",
        "ORDERING",
        "ERROR_FIND",
        "CLOZE",
      ],
      desc: "Gramatyka, słownictwo, Use of English",
    },
    {
      label: "Praca z tekstem",
      icon: "📄",
      types: ["WIAZKA"],
      desc: "Reading comprehension",
    },
    {
      label: "Słuchanie",
      icon: "🎧",
      types: ["LISTENING"],
      desc: "AI generuje nagrania w czasie rzeczywistym",
    },
  ],
  wos: [
    {
      label: "Pisanie",
      icon: "✏️",
      types: ["OPEN", "ESSAY"],
      desc: "Pytania otwarte i wypracowania",
    },
    {
      label: "Testy i quizy",
      icon: "🔘",
      types: [
        "CLOSED",
        "MULTI_SELECT",
        "TRUE_FALSE",
        "FILL_IN",
        "MATCHING",
        "ORDERING",
        "ERROR_FIND",
        "CLOZE",
      ],
      desc: "Zamknięte, wyboru, łączenia",
    },
    {
      label: "Materiały źródłowe",
      icon: "🗺️",
      types: ["WIAZKA", "TABLE_DATA", "GRAPH_INTERPRET"],
      desc: "Teksty, grafiki, mapy, tabele",
    },
  ],
  historia: [
    {
      label: "Pisanie",
      icon: "✏️",
      types: ["OPEN", "ESSAY"],
      desc: "Pytania otwarte i wypracowania",
    },
    {
      label: "Testy i quizy",
      icon: "🔘",
      types: [
        "CLOSED",
        "MULTI_SELECT",
        "TRUE_FALSE",
        "FILL_IN",
        "MATCHING",
        "ORDERING",
        "ERROR_FIND",
        "CLOZE",
      ],
      desc: "Zamknięte, wyboru, łączenia",
    },
    {
      label: "Materiały źródłowe",
      icon: "🗺️",
      types: ["WIAZKA", "TABLE_DATA", "GRAPH_INTERPRET"],
      desc: "Teksty źródłowe, mapy, grafiki",
    },
  ],
  geografia: [
    {
      label: "Pisanie",
      icon: "✏️",
      types: ["OPEN", "ESSAY"],
      desc: "Pytania otwarte i wypracowania",
    },
    {
      label: "Testy i quizy",
      icon: "🔘",
      types: [
        "CLOSED",
        "MULTI_SELECT",
        "TRUE_FALSE",
        "FILL_IN",
        "MATCHING",
        "ORDERING",
        "ERROR_FIND",
        "CLOZE",
      ],
      desc: "Zamknięte, wyboru, łączenia",
    },
    {
      label: "Materiały źródłowe",
      icon: "🗺️",
      types: ["WIAZKA", "TABLE_DATA", "GRAPH_INTERPRET"],
      desc: "Mapy, tabele, wykresy, dane",
    },
  ],
};

const QUESTION_COUNTS = [5, 10, 15, 20, 30];

export function QuizSetupScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const { isPremium } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>();
  const [selectedCategory, setSelectedCategory] =
    useState<SessionCategory | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [subjectDetail, setSubjectDetail] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const [subjectsData, dashData] = await Promise.all([
            subjectsApi.getSubjects(),
            getDashboard().catch(() => null),
          ]);

          if (cancelled) return;

          let active = subjectsData.filter((s) => s.isActive);

          // Sortuj po ostatnich sesjach
          if (dashData?.recentSessions?.length) {
            const orderMap = new Map<string, number>();
            dashData.recentSessions.forEach((s: any) => {
              const match = active.find((sub) => sub.slug === s.subject.slug);
              if (match && !orderMap.has(match.id)) {
                orderMap.set(match.id, orderMap.size);
              }
            });
            active.sort((a, b) => {
              const aO = orderMap.get(a.id) ?? 999;
              const bO = orderMap.get(b.id) ?? 999;
              return aO - bO;
            });
          }

          // Preselected z dashboardu — na 1. miejsce
          const preselectedId = route.params?.subjectId;
          if (preselectedId) {
            const idx = active.findIndex((s) => s.id === preselectedId);
            if (idx > 0) {
              const [item] = active.splice(idx, 1);
              active.unshift(item);
            }
            const match = active.find((s) => s.id === preselectedId);
            if (match) {
              setSelectedSubject(match);
              loadSubjectDetail(match.slug);
            }
          } else {
            // Reset gdy wracamy bez preselected
            setSelectedSubject(null);
            setSubjectDetail(null);
            setSelectedTopic(undefined);
            setSelectedCategory(null);
          }

          setSubjects(active);
        } catch (err) {
          console.error(err);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [route.params?.subjectId]),
  );

  const loadSubjectDetail = async (slug: string) => {
    try {
      const detail = await subjectsApi.getSubject(slug);
      setSubjectDetail(detail);
    } catch {}
  };

  const handleSelectSubject = (s: Subject) => {
    setSelectedSubject(s);
    setSelectedTopic(undefined);
    setSelectedCategory(null);
    loadSubjectDetail(s.slug);
  };

  const categories = selectedSubject
    ? SUBJECT_CATEGORIES[selectedSubject.slug] || []
    : [];
  const topics =
    subjectDetail?.topics?.filter((t: any) => t.questionCount > 0) || [];

  if (!isPremium) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing[6],
        }}
      >
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: theme.text,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Quiz wymaga Premium
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.textSecondary,
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 24,
          }}
        >
          Wykup subskrypcję, aby uzyskać dostęp do quizów.
        </Text>
        <Button
          title="Zobacz plany Premium"
          onPress={() =>
            navigation
              .getParent()
              ?.navigate("ProfileTab", { screen: "Subscription" })
          }
          icon={<Ionicons name="diamond" size={16} color="#fff" />}
        />
      </View>
    );
  }

  const handleStart = async () => {
    if (!selectedSubject) return Alert.alert("Wybierz przedmiot");
    setLoading(true);
    try {
      // ── LISTENING-only: use dedicated endpoint ──────────────────────
      if (
        selectedCategory?.types.length === 1 &&
        selectedCategory.types[0] === "LISTENING"
      ) {
        navigation.navigate("QuizPlay", {
          sessionId: "__listening__",
          questions: [],
          subjectName: selectedSubject.name,
          subjectId: selectedSubject.id,
          questionTypes: ["LISTENING"],
        });
        setLoading(false);
        return;
      }
      const session = await createSession({
        subjectId: selectedSubject.id,
        type: "PRACTICE",
        topicId: selectedTopic,
        questionCount,
      });
      if (session.error) {
        Alert.alert("Błąd", session.error);
        return;
      }

      let questions = session.questions;
      if (selectedCategory) {
        const filtered = await getQuestions({
          subjectId: selectedSubject.id,
          topicId: selectedTopic,
          types: selectedCategory.types.join(","),
          shuffle: true,
          limit: questionCount,
        });
        questions = filtered.questions;
      }

      // ── CHANGED: pass subjectId + questionTypes ──────────────────────
      navigation.navigate("QuizPlay", {
        sessionId: session.sessionId,
        questions,
        subjectName: selectedSubject.name,
        subjectId: selectedSubject.id,
        questionTypes: selectedCategory?.types,
      });
    } catch (err: any) {
      Alert.alert("Błąd", err.message || "Nie udało się utworzyć sesji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: theme.text,
          marginBottom: 4,
        }}
      >
        Nowa sesja nauki
      </Text>
      <Text
        style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 24 }}
      >
        Wybierz przedmiot i typ sesji
      </Text>

      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: theme.text,
          marginBottom: 10,
        }}
      >
        1. Wybierz przedmiot
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 24 }}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => handleSelectSubject(s)}
              style={{
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: radius.xl,
                borderWidth: 2,
                borderColor:
                  selectedSubject?.id === s.id
                    ? colors.brand[500]
                    : theme.border,
                backgroundColor:
                  selectedSubject?.id === s.id
                    ? colors.brand[500] + "0D"
                    : "transparent",
                minWidth: 80,
              }}
            >
              <Text style={{ fontSize: 24, marginBottom: 4 }}>
                {s.icon || "📚"}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color:
                    selectedSubject?.id === s.id
                      ? colors.brand[600]
                      : theme.textSecondary,
                }}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {selectedSubject && topics.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: theme.text,
              marginBottom: 10,
            }}
          >
            2. Wybierz temat (opcjonalnie)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => setSelectedTopic(undefined)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radius.xl,
                  backgroundColor: !selectedTopic
                    ? colors.navy[500]
                    : theme.inputBg,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: !selectedTopic ? "#fff" : theme.textSecondary,
                  }}
                >
                  Wszystkie
                </Text>
              </TouchableOpacity>
              {topics.map((t: any) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelectedTopic(t.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: radius.xl,
                    backgroundColor:
                      selectedTopic === t.id ? colors.navy[500] : theme.inputBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      color:
                        selectedTopic === t.id ? "#fff" : theme.textSecondary,
                    }}
                  >
                    {t.name} ({t.questionCount})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {selectedSubject && (
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: theme.text,
              marginBottom: 10,
            }}
          >
            {topics.length > 0 ? "3" : "2"}. Kategoria pytań
          </Text>
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              activeOpacity={0.85}
            >
              <Card
                variant="stat"
                style={{
                  borderWidth: 2,
                  borderColor: !selectedCategory
                    ? colors.brand[500]
                    : theme.cardBorder,
                  backgroundColor: !selectedCategory
                    ? colors.brand[500] + "0D"
                    : theme.card,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 24 }}>📚</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: theme.text,
                    }}
                  >
                    Wszystkie typy
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    Mix wszystkich rodzajów pytań
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.label}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.85}
              >
                <Card
                  variant="stat"
                  style={{
                    borderWidth: 2,
                    borderColor:
                      selectedCategory?.label === cat.label
                        ? colors.brand[500]
                        : theme.cardBorder,
                    backgroundColor:
                      selectedCategory?.label === cat.label
                        ? colors.brand[500] + "0D"
                        : theme.card,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: theme.text,
                      }}
                    >
                      {cat.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      {cat.desc}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {selectedSubject && (
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: theme.text,
              marginBottom: 10,
            }}
          >
            {topics.length > 0 ? "4" : "3"}. Liczba pytań
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {QUESTION_COUNTS.map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setQuestionCount(n)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.xl,
                  backgroundColor:
                    n === questionCount ? colors.brand[500] : theme.inputBg,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: n === questionCount ? "#fff" : theme.textSecondary,
                  }}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {selectedSubject && (
        <Button
          title={`Rozpocznij sesję (${questionCount} pytań)`}
          onPress={handleStart}
          loading={loading}
          icon={<Ionicons name="play" size={18} color="#fff" />}
          size="lg"
        />
      )}
    </ScrollView>
  );
}
