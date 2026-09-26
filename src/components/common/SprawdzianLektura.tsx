// „Sprawdzian z lektury lub epoki” na pulpicie — lustro webowego
// components/dashboard/SprawdzianLektura.tsx (Karol 26.09.2026). Epoka zawęża
// listę lektur; dotknięcie lektury startuje quiz od razu, sama epoka startuje
// quiz z całej epoki (pytania o epoce + jej lektury) przyciskiem. Tylko polski.
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { createSession } from "../../api/sessions";

interface Topic {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  author?: string | null;
  questionCount: number;
  dateFrom?: string | null;
  dateTo?: string | null;
}

const COUNT = 10;

function pytan(n: number) {
  if (n === 1) return "pytanie";
  const n10 = n % 10, n100 = n % 100;
  return n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? "pytania" : "pytań";
}

export function SprawdzianLektura({
  subject,
  navigation,
}: {
  // Wpis z GET /subjects (z tematami) — backend zwraca epoki i lektury.
  subject: { id: string; name: string; topics?: Topic[] } | undefined;
  navigation: any;
}) {
  const { colors: theme } = useTheme();
  const [epokaId, setEpokaId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const topics = subject?.topics ?? [];
  const epoki = useMemo(() => {
    const withChildren = new Set(
      topics.filter((t) => t.depth === 1 && t.parentId).map((t) => t.parentId),
    );
    return topics.filter((t) => t.depth === 0 && withChildren.has(t.id));
  }, [topics]);
  const grupy = useMemo(
    () =>
      epoki
        .filter((e) => !epokaId || e.id === epokaId)
        .map((e) => ({
          epoka: e,
          lektury: topics.filter((t) => t.depth === 1 && t.parentId === e.id),
        }))
        .filter((g) => g.lektury.length > 0),
    [topics, epoki, epokaId],
  );

  if (!subject || epoki.length === 0) return null;
  const epoka = epoki.find((e) => e.id === epokaId);

  const start = async (topicId: string) => {
    setStarting(topicId);
    try {
      const session: any = await createSession({
        subjectId: subject.id,
        type: "PRACTICE",
        topicId,
        questionCount: COUNT,
      });
      if (session?.error) {
        Alert.alert("Błąd", session.error);
        return;
      }
      navigation.navigate("QuizTab", {
        screen: "QuizPlay",
        params: {
          sessionId: session.sessionId,
          questions: session.questions,
          subjectName: subject.name,
          subjectId: subject.id,
        },
      });
    } catch (err: any) {
      Alert.alert("Błąd", err.message || "Nie udało się uruchomić sprawdzianu.");
    } finally {
      setStarting(null);
    }
  };

  const lekturaRow = (l: Topic) => (
    <TouchableOpacity
      key={l.id}
      disabled={starting !== null}
      onPress={() => start(l.id)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: theme.border + "55",
        marginBottom: 6,
        opacity: starting !== null && starting !== l.id ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }} numberOfLines={1}>
          {l.name}
        </Text>
        <Text style={{ fontSize: 11, color: theme.textSecondary }} numberOfLines={1}>
          {l.author ? `${l.author} · ` : ""}
          {l.questionCount} {pytan(l.questionCount)}
        </Text>
      </View>
      {starting === l.id ? (
        <ActivityIndicator size="small" color={colors.brand[500]} />
      ) : (
        <Text style={{ fontSize: 16, color: colors.brand[500] }}>→</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View
      style={{
        marginBottom: 20,
        padding: 16,
        borderRadius: 20,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
        📖 Sprawdzian z lektury lub epoki
      </Text>
      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, marginBottom: 12 }}>
        Wybierz lekturę albo całą epokę. Pytania będą tylko z tego, co wybierzesz.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {epoki.map((e) => {
          const on = e.id === epokaId;
          return (
            <TouchableOpacity
              key={e.id}
              onPress={() => setEpokaId(on ? null : e.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 99,
                backgroundColor: on ? colors.brand[500] : theme.border + "99",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#fff" : theme.text }}>
                {e.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {epoka && (
        <TouchableOpacity
          disabled={starting !== null}
          onPress={() => start(epoka.id)}
          style={{
            marginTop: 12,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: colors.brand[500],
            alignItems: "center",
            opacity: starting !== null && starting !== epoka.id ? 0.5 : 1,
          }}
        >
          {starting === epoka.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff", textAlign: "center" }}>
              Sprawdzian z całej epoki: {Math.min(COUNT, epoka.questionCount)} {pytan(Math.min(COUNT, epoka.questionCount))}
              {epoka.questionCount > COUNT ? ` (z ${epoka.questionCount})` : ""} →
            </Text>
          )}
        </TouchableOpacity>
      )}

      <View style={{ marginTop: 12 }}>
        {epoka ? (
          <>
            <Text style={{ fontSize: 12, color: theme.textTertiary, marginBottom: 8 }}>
              albo konkretna lektura z tej epoki:
            </Text>
            {grupy.flatMap((g) => g.lektury).map(lekturaRow)}
          </>
        ) : showAll ? (
          grupy.map((g) => (
            <View key={g.epoka.id} style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.5, color: theme.textTertiary, marginBottom: 6 }}>
                {g.epoka.name.toUpperCase()}
              </Text>
              {g.lektury.map(lekturaRow)}
            </View>
          ))
        ) : (
          <TouchableOpacity onPress={() => setShowAll(true)} style={{ paddingVertical: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.brand[500] }}>
              Wybierz epokę albo pokaż wszystkie lektury (
              {grupy.reduce((n, g) => n + g.lektury.length, 0)}) ▸
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
