// ============================================================================
// „Kontynuuj naukę” / „Zacznij naukę”: główny przycisk pulpitu
// src/components/common/ContinueLearning.tsx
//
// Źródło: GET /sessions/active-latest (backend routes/sessions.ts):
//   session      najnowsza sesja Quizu w toku (bez zadań od korepetytora,
//                słuchania i powtórek), z przedmiotem i licznikiem odpowiedzi,
//   startSubject przedmiot do nowej sesji (ostatnio ćwiczony; przy jednym
//                przedmiocie w zakresie, np. ścieżka zdaj, ten jedyny).
//
// Reguły (Karol 2.10.2026):
//   1. Jest sesja w toku → przycisk ją wznawia (ta sama sesja, pytania bez
//      już rozwiązanych; mechanika jak „Ostatnia aktywność”).
//   2. Widać, co się wznowi (ikona i nazwa przedmiotu, „4/10”). Cały kafel
//      jest jednym przyciskiem ze strzałką; bez zamykania sesji z pulpitu
//      (Karol 2.10.2026: POST /sessions/:id/abandon zostaje w backendzie,
//      ale UI go nie woła).
//   3. Brak sesji → nowa sesja od razu, bez ekranu konfiguracji, z ostatnio
//      ćwiczonego przedmiotu; konto bez historii → ekran wyboru.
//   4. Etykieta: „Kontynuuj naukę” albo „Zacznij naukę”.
// ============================================================================

import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../api/client";
import { getQuestions } from "../../api/questions";
import { createSession, completeSession } from "../../api/sessions";
import { fontFamily as F } from "../../theme/typography";
import { colors } from "../../theme/colors";

export interface ContinueSubject {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface ActiveLatest {
  session: {
    id: string;
    type: string;
    subject: ContinueSubject;
    topic: { id: string; name: string; slug: string } | null;
    difficulty: number | null;
    questionsAnswered: number;
    questionCount: number;
    startedAt: string;
  } | null;
  startSubject: ContinueSubject | null;
}

interface ResumeInfo {
  id: string;
  status: string;
  subject: { id: string; slug: string; name: string };
  topic: { id: string } | null;
  difficulty: number | null;
  questionCount: number;
  questionsAnswered: number;
  answeredQuestionIds: string[];
}

const NEW_SESSION_COUNT = 10;

export function useContinueLearning(
  navigation: any,
  opts: {
    /** Zawężenie do przedmiotu (np. ścieżka zdaj). Bez = cały zakres marki. */
    subjectSlug?: string;
    /** Nazwa przedmiotu w Quizie (osmo: krótka nazwa). */
    nameOf?: (s: { slug: string; name: string }) => string;
    /** Brak sesji i brak przedmiotu → ekran wyboru. */
    onChooseSubject?: () => void;
    /** Pobieraj tylko dla konta z dostępem (darmowe i tak nie zacznie). */
    enabled?: boolean;
  } = {},
) {
  const { subjectSlug, nameOf, onChooseSubject, enabled = true } = opts;
  const [info, setInfo] = useState<ActiveLatest | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const r = await api<ActiveLatest>("/sessions/active-latest", {
        params: subjectSlug ? { subjectSlug } : undefined,
      });
      setInfo(r);
    } catch {
      // Starszy backend bez trasy: przycisk działa jak „Zacznij naukę”.
      setInfo(null);
    }
  }, [enabled, subjectSlug]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const label = info?.session ? "Kontynuuj naukę" : "Zacznij naukę";
  const display = (s: { slug: string; name: string }) => (nameOf ? nameOf(s) : s.name);

  const chooseSubject = () =>
    onChooseSubject
      ? onChooseSubject()
      : navigation.navigate("QuizTab", { screen: "QuizSetup" });

  const openPlay = (params: {
    sessionId: string;
    questions: any[];
    subject: { id: string; slug: string; name: string };
  }) =>
    navigation.navigate("QuizTab", {
      screen: "QuizPlay",
      initial: false,
      params: {
        sessionId: params.sessionId,
        questions: params.questions,
        subjectName: display(params.subject),
        subjectId: params.subject.id,
      },
    });

  const startNew = async (subject: ContinueSubject) => {
    const s = await createSession({
      subjectId: subject.id,
      type: "PRACTICE",
      questionCount: NEW_SESSION_COUNT,
    });
    if (s.error || !s.questions?.length) {
      // Brak pytań albo błąd: ekran konfiguracji z wybranym przedmiotem.
      navigation.navigate("QuizTab", {
        screen: "QuizSetup",
        params: { subjectId: subject.id },
      });
      return;
    }
    openPlay({ sessionId: s.sessionId, questions: s.questions, subject });
  };

  const resume = async (sessionId: string): Promise<boolean> => {
    const r = await api<ResumeInfo>(`/sessions/${encodeURIComponent(sessionId)}/resume`);
    if (r.status !== "IN_PROGRESS") return false;
    const level = r.difficulty
      ? [Math.max(1, r.difficulty - 1), r.difficulty, Math.min(5, r.difficulty + 1)].join(",")
      : undefined;
    const left = Math.max(1, (r.questionCount || NEW_SESSION_COUNT) - (r.questionsAnswered || 0));
    const pool = await getQuestions({
      subjectId: r.subject.id,
      ...(r.topic ? { topicIds: r.topic.id } : {}),
      ...(level ? { difficulties: level } : {}),
      exclude: r.answeredQuestionIds.join(",") || undefined,
      shuffle: true,
      limit: left,
    });
    if (!pool.questions.length) {
      // Pula wyczerpana: domykamy sesję, wynik zostaje w historii.
      await completeSession(r.id).catch(() => {});
      return false;
    }
    openPlay({ sessionId: r.id, questions: pool.questions, subject: r.subject });
    return true;
  };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (info?.session && (await resume(info.session.id))) return;
      const subject = info?.startSubject ?? info?.session?.subject ?? null;
      if (subject) await startNew(subject);
      else chooseSubject();
    } catch (err: any) {
      if (err?.status === 403 || err?.code === "PREMIUM_REQUIRED") return chooseSubject();
      Alert.alert("Nie udało się otworzyć nauki", err?.message || "Spróbuj ponownie.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return { info, busy, label, run, refresh, display };
}

export type ContinueLearning = ReturnType<typeof useContinueLearning>;

/**
 * Kafel „Kontynuuj naukę”: ikona i nazwa przedmiotu, postęp sesji i strzałka.
 * Cały kafel to jeden przycisk (wznawia albo zaczyna), bez drugiej akcji.
 * tone="onBrand" = na kolorowym tle hero (biały tekst), "card" = na karcie.
 */
export function ContinueLearningInfo({
  cl,
  tone = "card",
  style,
}: {
  cl: ContinueLearning;
  tone?: "onBrand" | "card";
  style?: any;
}) {
  const { colors: theme } = useTheme();
  const s = cl.info?.session;
  const start = !s ? cl.info?.startSubject : null;
  const subject = s?.subject ?? start ?? null;

  const onBrand = tone === "onBrand";
  const main = onBrand ? "#fff" : theme.text;
  const sub = onBrand ? "#ffffffCC" : theme.textSecondary;
  const tint = subject?.color || colors.brand[500];

  const title = s
    ? `Kontynuuj quiz: ${cl.display(s.subject)} · ${s.questionsAnswered}/${s.questionCount}`
    : start
      ? `Nowa sesja: ${cl.display(start)}`
      : cl.label;
  const detail = s
    ? s.topic?.name || "Pytania z różnych działów"
    : start
      ? "10 pytań, bez ustawiania"
      : "Wybierz przedmiot i zacznij";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={cl.run}
      disabled={cl.busy}
      accessibilityRole="button"
      accessibilityLabel={subject ? `Kontynuuj naukę: ${cl.display(subject)}` : cl.label}
      accessibilityState={{ busy: cl.busy, disabled: cl.busy }}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 10,
          borderRadius: 16,
          // Jak pozostałe karty pulpitu (tło i ramka motywu) — kolorowe tło
          // przedmiotu odstawało w jasnym motywie (Karol 2.10.2026).
          backgroundColor: onBrand ? "#ffffff1F" : theme.card,
          borderWidth: onBrand ? 0 : 1,
          borderColor: theme.cardBorder ?? theme.border,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: onBrand ? "#ffffff2E" : tint + "26",
        }}
      >
        <Text style={{ fontSize: 18 }}>{subject?.icon || "📚"}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: F.body.bold, fontSize: 13.5, color: main }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: F.body.regular, fontSize: 12, color: sub, marginTop: 1 }}>
          {detail}
        </Text>
      </View>
      <View style={{ width: 24, alignItems: "center" }}>
        {cl.busy ? (
          <ActivityIndicator size="small" color={onBrand ? "#fff" : tint} />
        ) : (
          <Text style={{ fontFamily: F.display.bold, fontSize: 20, color: onBrand ? "#fff" : tint }}>→</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Samodzielny kafel (pulpit bez hero, np. Matury): to samo, na tle karty.
 */
export function ContinueLearningCard({ cl, style }: { cl: ContinueLearning; style?: any }) {
  return <ContinueLearningInfo cl={cl} tone="card" style={[{ padding: 14, borderRadius: 20 }, style]} />;
}
