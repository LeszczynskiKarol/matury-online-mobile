// „Szybka powtórka” na pulpicie Premium: lustro webowego paska
// components/dashboard (Karol 2.10.2026).
//   Wiersz 1: przedmioty ucznia (najczęściej używany pierwszy), ostatni wybór
//             zapamiętany w SecureStore.
//   Wiersz 2: polski → epoka, potem lektura; reszta → dział, potem opcjonalny
//             szczegółowy temat (depth 1 z tego działu). Tematy z GET /subjects
//             (jak QuizSetup), a gdy ich brak, z GET /subjects/:slug.
//   Lektura/temat startuje quiz od razu (10 pytań); sam dział/epoka pokazuje
//   przycisk „Powtórz cały dział” / „Powtórz całą epokę”.
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { createSession } from "../../api/sessions";
import { getSubject, type Subject } from "../../api/subjects";

interface QTopic {
  id: string;
  slug?: string;
  name: string;
  depth: number;
  parentId: string | null;
  author?: string | null;
  questionCount: number;
  sortOrder?: number;
}

type QSubject = Subject & { topics?: QTopic[] };

interface ProgressEntry {
  subject: { slug: string };
  questionsAnswered: number;
  hidden?: boolean;
  quiz?: { lastAnsweredAt: string | null } | null;
  lastSessionAt?: string | null;
}

const COUNT = 10;
const STORE_KEY = "quickReview.subjectSlug";

function pytan(n: number) {
  if (n === 1) return "pytanie";
  const n10 = n % 10,
    n100 = n % 100;
  return n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? "pytania" : "pytań";
}

/** „Język polski (matura)” → „Polski”, „Matematyka” bez zmian. */
function shortName(name: string) {
  const base = name.split(" — ")[0].split(" (")[0].trim();
  const m = base.match(/^Język\s+(.+)$/i);
  if (!m) return base;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
}

const usable = (t: QTopic) =>
  t.questionCount > 0 &&
  t.slug !== "rozumienie-ze-sluchu" &&
  !/rozumienie ze słuchu/i.test(t.name ?? "");

export function QuickReview({
  subjects,
  progress,
  navigation,
}: {
  subjects: QSubject[];
  progress: ProgressEntry[] | undefined;
  navigation: any;
}) {
  const { colors: theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Przedmioty ucznia: najwięcej odpowiedzi pierwsze, remis → ostatnia aktywność.
  const ordered = useMemo(() => {
    const at = (p: ProgressEntry) =>
      Math.max(
        0,
        ...[p.quiz?.lastAnsweredAt, p.lastSessionAt]
          .filter(Boolean)
          .map((d) => new Date(d as string).getTime()),
      );
    const prog = (progress ?? [])
      .filter((p) => !p.hidden)
      .sort((a, b) => b.questionsAnswered - a.questionsAnswered || at(b) - at(a));
    const bySlug = new Map(subjects.map((s) => [s.slug, s]));
    const list = prog.map((p) => bySlug.get(p.subject.slug)).filter(Boolean) as QSubject[];
    return list.length > 0 ? list : subjects;
  }, [subjects, progress]);

  const [slug, setSlug] = useState<string | null>(null);
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [parentId, setParentId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [fetched, setFetched] = useState<Record<string, QTopic[]>>({});

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((v) => setStored(v))
      .catch(() => setStored(null));
  }, []);

  // Domyślnie: zapamiętany przedmiot, a gdy go nie ma na liście, najczęściej używany.
  useEffect(() => {
    if (stored === undefined || ordered.length === 0) return;
    if (slug && ordered.some((s) => s.slug === slug)) return;
    const pick = ordered.find((s) => s.slug === stored) ?? ordered[0];
    setSlug(pick.slug);
  }, [stored, ordered, slug]);

  const subject = ordered.find((s) => s.slug === slug);
  const isPolish = subject?.slug === "polski";

  // Lista /subjects zwykle niesie tematy; gdy nie, dociągamy szczegóły przedmiotu.
  useEffect(() => {
    if (!subject || subject.topics || fetched[subject.slug]) return;
    let alive = true;
    getSubject(subject.slug)
      .then((d) => {
        if (alive) setFetched((f) => ({ ...f, [subject.slug]: (d.topics ?? []) as QTopic[] }));
      })
      .catch(() => {
        if (alive) setFetched((f) => ({ ...f, [subject.slug]: [] }));
      });
    return () => {
      alive = false;
    };
  }, [subject, fetched]);

  const topics = useMemo(
    () => ((subject?.topics ?? (subject ? fetched[subject.slug] : undefined)) ?? []).filter(usable),
    [subject, fetched],
  );
  const loadingTopics = !!subject && !subject.topics && !fetched[subject.slug];
  const parents = useMemo(
    () =>
      topics
        .filter((t) => (t.depth ?? 0) === 0)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [topics],
  );
  const parent = parents.find((p) => p.id === parentId);
  const children = useMemo(
    () =>
      parent
        ? topics
            .filter((t) => t.depth === 1 && t.parentId === parent.id)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        : [],
    [topics, parent],
  );

  if (ordered.length === 0) return null;

  const chooseSubject = (s: QSubject) => {
    if (s.slug === slug) return;
    setSlug(s.slug);
    setParentId(null);
    SecureStore.setItemAsync(STORE_KEY, s.slug).catch(() => {});
  };

  const start = async (topic: QTopic) => {
    if (!subject || starting) return;
    setStarting(topic.id);
    try {
      const session: any = await createSession({
        subjectId: subject.id,
        type: "PRACTICE",
        topicId: topic.id,
        questionCount: COUNT,
      });
      if (session?.error) {
        Alert.alert("Błąd", session.error);
        return;
      }
      if (!session?.questions?.length) {
        Alert.alert("Brak pytań", "W tym temacie nie ma jeszcze pytań. Wybierz inny.");
        return;
      }
      setSheetOpen(false);
      navigation.navigate("QuizTab", {
        screen: "QuizPlay",
        initial: false,
        params: {
          sessionId: session.sessionId,
          questions: session.questions,
          subjectName: subject.name,
          subjectId: subject.id,
        },
      });
    } catch (err: any) {
      Alert.alert("Nie udało się uruchomić quizu", err?.message || "Spróbuj ponownie.");
    } finally {
      setStarting(null);
    }
  };

  const chip = (key: string, label: string, on: boolean, onPress: () => void, icon?: string | null, count?: number) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      disabled={starting !== null}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        maxWidth: 240,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 99,
        // Wybrany: delikatne zabarwienie zamiast pełnej zieleni (Karol 2.10.2026).
        backgroundColor: on ? colors.brand[500] + "1F" : theme.inputBg,
        borderWidth: 1,
        borderColor: on ? colors.brand[500] + "88" : theme.border,
      }}
    >
      {icon ? <Text style={{ fontSize: 14 }}>{icon}</Text> : null}
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, fontSize: 13, fontWeight: "600", color: on ? colors.brand[500] : theme.text }}
      >
        {label}
      </Text>
      {count != null && (
        <Text style={{ fontSize: 11, fontWeight: "600", color: on ? "#ffffffCC" : theme.textTertiary }}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );

  const parentNoun = isPolish ? "epokę" : "dział";
  const childNoun = isPolish ? "lekturę" : "temat";
  const wholeLabel =
    isPolish && children.length > 0 ? "Powtórz całą epokę" : "Powtórz cały dział";

  return (
    <View
      style={{
        marginBottom: 20,
        padding: 14,
        borderRadius: 20,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>⚡ Szybka powtórka</Text>
      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2, marginBottom: 10 }}>
        Wybierz przedmiot i dział, quiz ruszy od razu.
      </Text>

      {/* Wiersz 1: przedmioty */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
      >
        {ordered.map((s) =>
          chip(s.slug, shortName(s.name), s.slug === slug, () => chooseSubject(s), s.icon || "📚"),
        )}
      </ScrollView>

      {/* Wiersz 2: działy / epoki */}
      <View style={{ marginTop: 8 }}>
        {loadingTopics ? (
          <ActivityIndicator size="small" color={colors.brand[500]} style={{ alignSelf: "flex-start", marginVertical: 6 }} />
        ) : parents.length === 0 ? (
          <Text style={{ fontSize: 12, color: theme.textTertiary, paddingVertical: 6 }}>
            Brak działów z pytaniami w tym przedmiocie.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
          >
            {parents.map((p) =>
              chip(p.id, p.name, p.id === parentId, () => setParentId(p.id === parentId ? null : p.id), null, p.questionCount),
            )}
          </ScrollView>
        )}
      </View>

      {parent && (
        // Dwa przyciski na całą szerokość, jeden pod drugim: najpierw cała
        // epoka / dział, pod spodem wybór lektury / tematu (Karol 2.10.2026).
        <View style={{ gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            disabled={starting !== null}
            onPress={() => start(parent)}
            accessibilityRole="button"
            style={{
              paddingVertical: 12,
              paddingHorizontal: 10,
              borderRadius: 14,
              backgroundColor: colors.brand[500] + "1F",
              borderWidth: 1,
              borderColor: colors.brand[500] + "66",
              alignItems: "center",
              justifyContent: "center",
              opacity: starting !== null && starting !== parent.id ? 0.5 : 1,
            }}
          >
            {starting === parent.id ? (
              <ActivityIndicator size="small" color={colors.brand[500]} />
            ) : (
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.brand[500] }}>
                {wholeLabel} →
              </Text>
            )}
          </TouchableOpacity>
          {children.length > 0 && (
            <TouchableOpacity
              disabled={starting !== null}
              onPress={() => setSheetOpen(true)}
              accessibilityRole="button"
              style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
                {isPolish ? "Powtórz wybraną lekturę" : "Powtórz wybrany temat"} ({children.length}) ▸
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!parent && parents.length > 0 && !loadingTopics && (
        <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 6 }}>
          Dotknij {parentNoun}, żeby powtórzyć całość albo wybrać {childNoun}.
        </Text>
      )}

      {/* Lista lektur / tematów: arkusz od dołu */}
      <Modal
        visible={sheetOpen && !!parent}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: "#00000066" }} onPress={() => setSheetOpen(false)} />
        <View
          style={{
            maxHeight: "75%",
            backgroundColor: theme.card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 10,
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.border,
              marginBottom: 10,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }} numberOfLines={1}>
                {parent?.name}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                Wybierz {childNoun}, quiz ruszy od razu ({COUNT} pytań).
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSheetOpen(false)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Zamknij"
            >
              <Text style={{ fontSize: 20, color: theme.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {children.map((t) => (
              <TouchableOpacity
                key={t.id}
                disabled={starting !== null}
                onPress={() => start(t)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  marginBottom: 6,
                  opacity: starting !== null && starting !== t.id ? 0.5 : 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }} numberOfLines={2}>
                    {t.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }} numberOfLines={1}>
                    {t.author ? `${t.author} · ` : ""}
                    {t.questionCount} {pytan(t.questionCount)}
                  </Text>
                </View>
                {starting === t.id ? (
                  <ActivityIndicator size="small" color={colors.brand[500]} />
                ) : (
                  <Text style={{ fontSize: 16, color: colors.brand[500] }}>→</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
