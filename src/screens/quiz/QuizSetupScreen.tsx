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
import { PremiumGate } from "../../components/common/PremiumGate";
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
  // Lustro webowego SessionSetup — do 25.09.2026 brakowało tu biznesu, więc
  // apka pokazywała przy nim samo „Wszystkie typy".
  "biznes-zarzadzanie": [
    {
      label: "Pisanie",
      icon: "✏️",
      types: ["OPEN"],
      desc: "Wyjaśnij, rozstrzygnij, zaproponuj, analiza przypadku",
    },
    {
      label: "Testy i quizy",
      icon: "🔘",
      types: ["CLOSED", "MULTI_SELECT", "TRUE_FALSE", "FILL_IN", "MATCHING", "ORDERING"],
      desc: "Zamknięte, wyboru, łączenia, kolejność",
    },
    {
      label: "Obliczenia",
      icon: "🧮",
      types: ["CALCULATION"],
      desc: "Wynagrodzenie netto, raty, próg rentowności",
    },
    {
      label: "Dane i wykresy",
      icon: "📈",
      types: ["TABLE_DATA", "GRAPH_INTERPRET", "WIAZKA"],
      desc: "Tabele, wykresy, wiązki z materiałem źródłowym",
    },
  ],
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
  niemiecki: [
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
  const { colors: theme, isDark } = useTheme();
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
  // Przedmioty z postępem na pulpicie („Twoje przedmioty”) — na górę wyboru.
  const [mySlugs, setMySlugs] = useState<string[]>([]);
  // Po wyborze przedmiotu siatka zwija się do jednej linijki „Zmień” (jak web).
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);

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
          const mine: string[] = ((dashData as any)?.subjectProgress ?? [])
            .filter((sp: any) => !sp.hidden)
            .map((sp: any) => sp.subject.slug);
          setMySlugs(mine);

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
              // „Ćwicz dalej” z dashboardu — ten sam temat co ostatnio
              // (nauka pod sprawdzian z jednej lektury / działu).
              const preselectedTopic = route.params?.topicId;
              if (preselectedTopic) setSelectedTopic(preselectedTopic);
            }
            setSubjectPickerOpen(!match);
          } else {
            // Bez parametru: pierwszy z „Twoich przedmiotów”, a gdy ich nie
            // ma — ostatnio ćwiczony (lista jest posortowana po sesjach).
            // Zwykle wystarczy wtedy „Rozpocznij” (jak na webie).
            const guess =
              active.find((s) => mine.includes(s.slug)) ??
              (dashData?.recentSessions?.length ? active[0] : null);
            setSelectedTopic(undefined);
            setSelectedCategory(null);
            if (guess) {
              setSelectedSubject(guess);
              loadSubjectDetail(guess.slug);
              setSubjectPickerOpen(false);
            } else {
              setSelectedSubject(null);
              setSubjectDetail(null);
              setSubjectPickerOpen(true);
            }
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
    setSubjectPickerOpen(false);
    setSelectedSubject(s);
    setSelectedTopic(undefined);
    setSelectedCategory(null);
    loadSubjectDetail(s.slug);
  };

  const categories = selectedSubject
    ? SUBJECT_CATEGORIES[selectedSubject.slug] || []
    : [];
  // Temat „XIV. Rozumienie ze słuchu" dubluje kafel kategorii „Słuchanie" —
  // zadania słuchowe mają tam swoje wejście (lustro webowego SessionSetup).
  // Tematy z listy /subjects (mają depth / parentId / autora i liczby pytań
  // z poddziałami), a gdyby ich brakło — ze szczegółów przedmiotu.
  const topicSource: any[] =
    (selectedSubject as any)?.topics ?? subjectDetail?.topics ?? [];
  const topics =
    topicSource.filter(
      (t: any) =>
        t.questionCount > 0 &&
        t.slug !== "rozumienie-ze-sluchu" &&
        !/rozumienie ze słuchu/i.test(t.name ?? ""),
    ) || [];

  if (!isPremium) {
    return <PremiumGate mode="quiz" />;
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

  // Hierarchia tematów jak na webie: polski (EPOCH_WORK) = epoki → lektury,
  // matematyka = działy → szczegółowe tematy; bez poddziałów zwykła lista.
  const hasDepth1 = topics.some((t: any) => t.depth === 1);
  const isEpochWork = (selectedSubject as any)?.taxonomyType === "EPOCH_WORK";
  const parents = hasDepth1 ? topics.filter((t: any) => (t.depth ?? 0) === 0) : [];
  const children = hasDepth1 ? topics.filter((t: any) => t.depth === 1) : [];
  const parentName = (id: string | null) => parents.find((e: any) => e.id === id)?.name;
  const pytan = (n: number) =>
    n === 1 ? "pytanie" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "pytania" : "pytań";
  const chipBg = theme.border + "66";
  const stepTitle = (t: string) => (
    <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text, marginBottom: 10 }}>{t}</Text>
  );
  const label = (t: string) => (
    <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: theme.textTertiary, marginBottom: 8, marginTop: 4 }}>
      {t}
    </Text>
  );
  const chip = (id: string | undefined, text: string, count?: number) => {
    const on = selectedTopic === id;
    return (
      <TouchableOpacity
        key={id ?? "__all__"}
        onPress={() => setSelectedTopic(id)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.xl,
          backgroundColor: on ? colors.navy[500] : chipBg,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "600", color: on ? "#fff" : theme.text }}>
          {text}
          {count != null ? <Text style={{ opacity: 0.6 }}> ({count})</Text> : null}
        </Text>
      </TouchableOpacity>
    );
  };
  const subjectTile = (s: Subject) => {
    const on = selectedSubject?.id === s.id;
    return (
      <TouchableOpacity
        key={s.id}
        onPress={() => handleSelectSubject(s)}
        style={{
          width: "31%",
          alignItems: "center",
          paddingHorizontal: 6,
          paddingVertical: 12,
          borderRadius: radius.xl,
          borderWidth: 2,
          borderColor: on ? colors.brand[500] : theme.border,
          backgroundColor: on ? colors.brand[500] + "0D" : "transparent",
        }}
      >
        <Text style={{ fontSize: 24, marginBottom: 4 }}>{s.icon || "📚"}</Text>
        <Text numberOfLines={2} style={{ fontSize: 11, fontWeight: "600", textAlign: "center", color: on ? colors.brand[600] : theme.text }}>
          {s.name}
        </Text>
        <Text style={{ fontSize: 10, color: theme.textTertiary, marginTop: 2 }}>
          {(s._count?.questions || 0).toLocaleString("pl-PL")} {pytan(s._count?.questions || 0)}
        </Text>
      </TouchableOpacity>
    );
  };
  const mineList = mySlugs
    .map((slug) => subjects.find((s) => s.slug === slug))
    .filter(Boolean) as Subject[];
  const restList = subjects.filter((s) => !mySlugs.includes(s.slug));
  const topicName = selectedTopic
    ? topics.find((t: any) => t.id === selectedTopic)?.name
    : null;
  const listeningOnly =
    selectedCategory?.types.length === 1 && selectedCategory.types[0] === "LISTENING";

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 150,
        paddingHorizontal: spacing[5],
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text, marginBottom: 4 }}>
        Nowa sesja nauki
      </Text>
      <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 24 }}>
        Wybierz, co chcesz ćwiczyć — resztę dobierze system.
      </Text>

      {/* 1. Przedmiot — zwinięty do jednej linijki po wyborze */}
      <View style={{ marginBottom: 24 }}>
        {stepTitle("1. Przedmiot")}
        {selectedSubject && !subjectPickerOpen ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.brand[500] + "99",
              backgroundColor: colors.brand[500] + "0D",
            }}
          >
            <Text style={{ fontSize: 26 }}>{selectedSubject.icon || "📚"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{selectedSubject.name}</Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                {(selectedSubject._count?.questions || 0).toLocaleString("pl-PL")}{" "}
                {pytan(selectedSubject._count?.questions || 0)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSubjectPickerOpen(true)}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: chipBg }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.brand[500] }}>Zmień</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {mineList.length > 0 && (
              <>
                {label("TWOJE PRZEDMIOTY")}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {mineList.map(subjectTile)}
                </View>
              </>
            )}
            {restList.length > 0 && (
              <>
                {mineList.length > 0 && label("POZOSTAŁE PRZEDMIOTY")}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {restList.map(subjectTile)}
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* 2. Temat (opcjonalnie) */}
      {selectedSubject && topics.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          {stepTitle("2. Wybierz temat (opcjonalnie)")}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {chip(undefined, "Wszystkie tematy")}
            {!hasDepth1 && topics.map((t: any) => chip(t.id, t.name, t.questionCount))}
          </View>
          {hasDepth1 && parents.length > 0 && (
            <View style={{ marginTop: 14 }}>
              {label(isEpochWork ? "📚 EPOKI" : "📚 DZIAŁY")}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {parents.map((t: any) => chip(t.id, t.name, t.questionCount))}
              </View>
            </View>
          )}
          {hasDepth1 && children.length > 0 && (
            <View style={{ marginTop: 14 }}>
              {label(`${isEpochWork ? "📖 LEKTURY" : "🎯 SZCZEGÓŁOWE TEMATY"} (${children.length})`)}
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 6,
                  maxHeight: 320,
                }}
              >
                <ScrollView nestedScrollEnabled>
                  {children.map((t: any) => {
                    const on = selectedTopic === t.id;
                    const ep = parentName(t.parentId);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setSelectedTopic(t.id)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: on ? colors.navy[500] : "transparent",
                        }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: on ? "#fff" : theme.text }}>
                          {t.name}
                          <Text style={{ fontSize: 11, opacity: 0.6 }}> ({t.questionCount})</Text>
                        </Text>
                        {(t.author || ep) && (
                          <Text numberOfLines={1} style={{ fontSize: 11, color: on ? "#ffffffb3" : theme.textSecondary }}>
                            {[t.author, ep].filter(Boolean).join(" · ")}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Kategoria pytań — kompaktowa siatka 2 kolumn */}
      {selectedSubject && (
        <View style={{ marginBottom: 24 }}>
          {stepTitle(`${topics.length > 0 ? "3" : "2"}. Kategoria pytań`)}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[null, ...categories].map((cat) => {
              const on = cat ? selectedCategory?.label === cat.label : !selectedCategory;
              return (
                <TouchableOpacity
                  key={cat?.label ?? "__all__"}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.85}
                  style={{
                    width: "48.5%",
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: on ? colors.brand[500] : theme.border,
                    backgroundColor: on ? colors.brand[500] + "0D" : isDark ? theme.card : "#FFFFFF",
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{cat ? cat.icon : "📚"}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
                    {cat ? cat.label : "Wszystkie typy"}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 15 }}>
                    {cat ? cat.desc : "Mix wszystkich rodzajów pytań"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Liczba pytań */}
      {selectedSubject && (
        <View style={{ marginBottom: 16 }}>
          {stepTitle(`${topics.length > 0 ? "4" : "3"}. Liczba pytań`)}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {QUESTION_COUNTS.map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setQuestionCount(n)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.xl,
                  backgroundColor: n === questionCount ? colors.brand[500] : chipBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: n === questionCount ? "#fff" : theme.text }}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>

    {/* Przyklejony pasek z podsumowaniem wyboru — zawsze widać, co się
        uruchomi, bez przewijania na koniec (jak na webie). */}
    {selectedSubject && (
      <View
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 12,
          paddingLeft: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>
            {selectedSubject.icon || "📚"} {selectedSubject.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: theme.textSecondary }}>
            {topicName ?? "wszystkie tematy"} ·{" "}
            {selectedCategory ? selectedCategory.label.toLowerCase() : "wszystkie typy"}
            {listeningOnly ? "" : ` · ${questionCount} ${pytan(questionCount)}`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleStart}
          disabled={loading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: colors.brand[500],
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
            {loading ? "Startuję…" : "Rozpocznij"}
          </Text>
          {!loading && <Ionicons name="play" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>
    )}
    </View>
  );
}
