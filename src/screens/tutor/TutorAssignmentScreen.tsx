// ============================================================================
// Zadanie od korepetytora — uruchomienie (strona ucznia)
// Lustro webowego AssignmentRunner.tsx. Quiz (zestaw z AI / ćwiczenie z banku)
// → QuizPlay z ZAMROŻONYM zestawem (createSession + assignmentTargetId).
// Arkusz → ExamPlay (dostęp weryfikuje serwer: examAssignedToStudent).
//
// Kolejność stanów jest celowa i PRZED jakąkolwiek logiką Premium: miejsce od
// korepetytora nie jest Premium, więc bramka Premium apki nie ma tu wstępu —
// serwer sam odmawia (NO_SEAT), a my tłumaczymy to po ludzku.
// ============================================================================

import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme";
import { getAssignmentTarget, KIND_LABEL, type AssignmentTarget } from "../../api/tutor";
import { createSession } from "../../api/sessions";
import { ApiError } from "../../api/client";
import { fmtDate, scoreColor, Pill } from "./TutorAssignmentsScreen";

const CODE_MESSAGE: Record<string, string> = {
  NO_SEAT: "Korepetytor nie przydzielił Ci jeszcze miejsca — poproś go o dostęp.",
  SET_NOT_READY: "Pytania są jeszcze w przygotowaniu. Odśwież za chwilę.",
  ASSIGNMENT_DONE: "To zadanie jest już rozwiązane.",
  ASSIGNMENT_NOT_FOUND: "Nie znaleziono zadania — mogło zostać usunięte przez korepetytora.",
  ASSIGNMENT_IS_EXAM: "To zadanie to arkusz — otwórz je jako egzamin.",
};

export function TutorAssignmentScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { targetId } = route.params as { targetId: string };
  const [t, setT] = useState<AssignmentTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      setT(await getAssignmentTarget(targetId));
      setError(null);
    } catch (e: any) {
      setError(e instanceof ApiError ? CODE_MESSAGE[e.code ?? ""] ?? e.message : "Nie udało się otworzyć zadania.");
    }
  }, [targetId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const goBackToList = () => navigation.navigate("TutorAssignments");

  const start = async () => {
    if (!t) return;
    if (t.kind === "EXAM") {
      if (!t.examId) return Alert.alert("Błąd", "Ten arkusz nie jest już dostępny.");
      navigation.getParent()?.navigate("ExamTab", {
        screen: "ExamPlay",
        params: { examId: t.examId, subjectId: t.subject?.id ?? "", attempt: Date.now() },
      });
      return;
    }
    if (!t.subject) return Alert.alert("Błąd", "Zadanie nie ma przedmiotu.");
    setStarting(true);
    try {
      const res = await createSession({
        subjectId: t.subject.id,
        type: "TOPIC_DRILL",
        topicId: t.topicId ?? undefined,
        questionCount: t.questionCount ?? undefined,
        assignmentTargetId: t.targetId,
      });
      if (res.error || !res.questions?.length) {
        Alert.alert("Nie można zacząć", CODE_MESSAGE[res.code ?? ""] ?? res.error ?? "Zadanie nie ma pytań.");
        return;
      }
      navigation.getParent()?.navigate("QuizTab", {
        screen: "QuizPlay",
        params: {
          sessionId: res.sessionId,
          questions: res.questions,
          subjectName: t.subject.name,
          subjectId: t.subject.id,
          assignmentTargetId: t.targetId,
          assignmentTitle: t.title,
        },
      });
    } catch (e: any) {
      const code = e instanceof ApiError ? e.code ?? "" : "";
      Alert.alert("Nie można zacząć", CODE_MESSAGE[code] ?? e.message ?? "Spróbuj ponownie.");
      if (code === "SET_NOT_READY" || code === "ASSIGNMENT_DONE") load();
    } finally {
      setStarting(false);
    }
  };

  const body = () => {
    if (error) return <StateCard emoji="⚠️" title="Nie udało się otworzyć zadania" text={error} theme={theme} action={{ label: "Wróć do zadań", onPress: goBackToList }} />;
    if (!t)
      return (
        <View style={{ paddingVertical: 48, alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      );

    if (t.status === "DONE") {
      return (
        <StateCard
          emoji="✅"
          title="Zadanie rozwiązane"
          text={`Wynik: ${t.scorePct ?? 0}%. Korepetytor widzi go u siebie.`}
          theme={theme}
          action={
            t.kind === "EXAM" && t.examAttemptId
              ? {
                  label: "Zobacz wyniki arkusza",
                  onPress: () =>
                    navigation.getParent()?.navigate("ExamTab", {
                      screen: "ExamResults",
                      params: { attemptId: t.examAttemptId },
                    }),
                }
              : { label: "Wróć do zadań", onPress: goBackToList }
          }
        />
      );
    }
    if (t.canRun === false) {
      return (
        <StateCard
          emoji="🔑"
          title="Korepetytor nie przydzielił Ci miejsca"
          text={`${t.tutorName} zadał Ci „${t.title}”, ale żeby to rozwiązać, potrzebujesz miejsca w grupie. Miejsce przydziela korepetytor — napisz do niego, a zadanie odblokuje się samo.`}
          theme={theme}
          action={{ label: "Wróć do zadań", onPress: goBackToList }}
        />
      );
    }
    if (t.setStatus === "GENERATING") {
      return (
        <StateCard
          emoji="⏳"
          title="Pytania są w przygotowaniu"
          text={`${t.tutorName} zadał Ci „${t.title}”. AI właśnie tworzy pytania — zwykle trwa to do dwóch minut.`}
          theme={theme}
          action={{ label: "Odśwież", onPress: load }}
          secondary={{ label: "Wróć do zadań", onPress: goBackToList }}
        />
      );
    }
    if (t.setStatus === "ERROR") {
      return (
        <StateCard
          emoji="⚠️"
          title="Nie udało się przygotować pytań"
          text="Daj znać korepetytorowi — musi wygenerować to zadanie jeszcze raz."
          theme={theme}
          action={{ label: "Wróć do zadań", onPress: goBackToList }}
        />
      );
    }

    const meta = [
      KIND_LABEL[t.kind],
      t.subject?.name,
      t.questionCount ? `${t.questionCount} pytań` : null,
      t.dueAt ? `termin ${fmtDate(t.dueAt)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const inProgress = t.status === "IN_PROGRESS";
    return (
      <Card>
        <Text style={{ fontSize: 34, marginBottom: 8 }}>{t.subject?.icon ?? "📘"}</Text>
        <Text style={{ fontSize: 20, fontFamily: "Outfit_700Bold", color: theme.text }}>{t.title}</Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
          od {t.tutorName} · {meta}
        </Text>
        {t.note ? (
          <View
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.brand[500] + "14",
              borderWidth: 1,
              borderColor: colors.brand[500] + "40",
            }}
          >
            <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", color: colors.brand[600] ?? colors.brand[500], marginBottom: 2 }}>
              OD KOREPETYTORA
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: theme.text }}>{t.note}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          {inProgress && <Pill label="w trakcie" color={colors.orange[500]} />}
          {t.dueAt && new Date(t.dueAt) < new Date() && <Pill label="po terminie" color={colors.red[500]} />}
        </View>
        <Button
          title={t.kind === "EXAM" ? (inProgress ? "Kontynuuj arkusz" : "Otwórz arkusz") : inProgress ? "Kontynuuj" : "Rozwiąż"}
          onPress={start}
          loading={starting}
          size="lg"
          style={{ marginTop: 18 }}
          icon={<Ionicons name={t.kind === "EXAM" ? "document-text" : "play"} size={18} color="#fff" />}
        />
        <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 10, textAlign: "center" }}>
          {t.kind === "EXAM"
            ? "Arkusz z timerem i oceną — wynik trafi do korepetytora."
            : "Odpowiedzi i wynik zobaczy też korepetytor."}
        </Text>
      </Card>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : goBackToList())} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontFamily: "Outfit_600SemiBold", color: theme.textSecondary }}>Zadanie od korepetytora</Text>
      </View>
      {body()}
    </ScrollView>
  );
}

function StateCard({
  emoji,
  title,
  text,
  theme,
  action,
  secondary,
}: {
  emoji: string;
  title: string;
  text: string;
  theme: any;
  action: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <Card style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 40, marginBottom: 10 }}>{emoji}</Text>
      <Text style={{ fontSize: 18, fontFamily: "Outfit_700Bold", color: theme.text, textAlign: "center", marginBottom: 6 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: theme.textSecondary, textAlign: "center", marginBottom: 18 }}>{text}</Text>
      <Button title={action.label} onPress={action.onPress} style={{ alignSelf: "stretch" }} />
      {secondary && <Button title={secondary.label} onPress={secondary.onPress} variant="ghost" style={{ alignSelf: "stretch", marginTop: 8 }} />}
    </Card>
  );
}

