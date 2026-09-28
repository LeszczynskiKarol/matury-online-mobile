// ============================================================================
// „Ostatnia aktywność” na pulpicie — jeden feed wszystkich trybów nauki
// src/components/common/RecentActivityList.tsx
//
// Dane: GET /dashboard → recentActivity (backend services/recent-activity.ts):
// Quiz, słuchanie, arkusze, wypracowania, diagnoza. Starszy backend bez pola:
// feed z recentSessions + recentExams.
//
// Każdy kafelek prowadzi dalej (Karol 28.09.2026): Quiz w toku → wznowienie
// TEJ SAMEJ sesji (GET /sessions/:id/resume + nowe pytania bez rozwiązanych),
// zakończona sesja → jej przebieg w Historii, arkusz → arkusz albo wynik,
// diagnoza → raport albo dokończenie. Wypracowania pisze się na stronie —
// w apce kafelek tylko informuje.
// ============================================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { colors } from "../../theme/colors";
import { api } from "../../api/client";
import { getQuestions } from "../../api/questions";
import { completeSession } from "../../api/sessions";

export type ActivityKind = "quiz" | "listening" | "exam" | "essay" | "diagnosis";

export interface ActivityItem {
  kind: ActivityKind;
  id: string;
  at: string;
  status: "IN_PROGRESS" | "COMPLETED" | "GRADING";
  subject: { slug: string; name: string; icon: string | null } | null;
  title?: string | null;
  topic?: { id: string; name: string; slug: string } | null;
  sessionType?: string;
  questionsAnswered?: number;
  accuracy?: number | null;
  xpEarned?: number;
  percentage?: number | null;
  points?: number | null;
  maxPoints?: number | null;
  examId?: string;
  token?: string;
  questionCount?: number;
}

/** Polska odmiana liczebnika: 1 pytanie, 2 pytania, 5 pytań, 22 pytania. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return `${n} ${one}`;
  const d = abs % 10;
  const dd = abs % 100;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** „przed chwilą”, „5 min temu”, „2 godz. temu”, „wczoraj”, „3 dni temu”, „12 wrz”. */
export function timeAgo(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diffMin = Math.floor((now.getTime() - t) / 60000);
  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min temu`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= startOfToday) return `${Math.floor(diffMin / 60)} godz. temu`;
  const days = Math.floor((startOfToday - t) / 86_400_000) + 1;
  if (days === 1) return "wczoraj";
  if (days < 7) return `${days} dni temu`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

/** Feed ze starszego backendu (bez recentActivity). */
export function legacyActivity(recentSessions: any[] = [], recentExams: any[] = []): ActivityItem[] {
  return [
    ...recentSessions.map(
      (s: any): ActivityItem => ({
        kind: "quiz",
        id: s.id,
        at: s.completedAt || s.startedAt,
        status: s.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETED",
        subject: s.subject ?? null,
        topic: s.topic ?? null,
        sessionType: s.type,
        questionsAnswered: s.questionsAnswered,
        accuracy: s.accuracy,
        xpEarned: s.xpEarned,
      }),
    ),
    ...recentExams.map(
      (e: any): ActivityItem => ({
        kind: "exam",
        id: e.attemptId,
        examId: e.examId,
        at: e.completedAt || e.startedAt,
        status: e.status,
        subject: e.subject ?? null,
        title: e.title,
        points: e.totalScore,
        maxPoints: e.maxPoints,
        percentage: e.percentage,
      }),
    ),
  ]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 8);
}

const KIND: Record<ActivityKind, { icon: string; label: string; tint: string }> = {
  quiz: { icon: "💡", label: "Quiz", tint: colors.brand[500] },
  listening: { icon: "🎧", label: "Słuchanie", tint: "#14b8a6" },
  exam: { icon: "📋", label: "Egzamin", tint: "#8b5cf6" },
  essay: { icon: "✍️", label: "Wypracowanie", tint: "#f59e0b" },
  diagnosis: { icon: "🎯", label: "Diagnoza", tint: "#10b981" },
};

function titleFor(it: ActivityItem): string {
  switch (it.kind) {
    case "quiz":
      if (it.sessionType === "REVIEW") return "Powtórka z fiszek";
      return it.topic?.name || it.title || "Pytania z różnych działów";
    case "listening":
      return "Rozumienie ze słuchu";
    case "diagnosis":
      return "Diagnoza poziomu";
    default:
      return it.title || it.subject?.name || KIND[it.kind].label;
  }
}

function detailsFor(it: ActivityItem): string[] {
  const parts: string[] = [];
  const n = it.questionsAnswered ?? 0;
  if (it.kind === "quiz") {
    parts.push(plural(n, "pytanie", "pytania", "pytań"));
    if (it.accuracy != null) parts.push(`${it.accuracy}% trafnych`);
  } else if (it.kind === "listening") {
    parts.push(plural(n, "nagranie", "nagrania", "nagrań"));
    if (it.accuracy != null) parts.push(`${it.accuracy}% trafnych`);
  } else if (it.kind === "exam" && it.status === "COMPLETED" && it.maxPoints) {
    parts.push(`${Math.round(it.points ?? 0)}/${it.maxPoints} pkt`);
  } else if (it.kind === "diagnosis" && it.status === "IN_PROGRESS" && it.questionCount) {
    parts.push(`${n} z ${it.questionCount} pytań`);
  } else if (it.kind === "essay") {
    parts.push("ocena na stronie");
  }
  return parts;
}

interface ResumeInfo {
  id: string;
  status: string;
  subject: { id: string; slug: string; name: string };
  topic: { id: string } | null;
  listening: boolean;
  difficulty: number | null;
  answeredQuestionIds: string[];
}

export function RecentActivityList({
  items,
  navigation,
  subjects = [],
}: {
  items: ActivityItem[];
  navigation: any;
  /** Katalog przedmiotów (slug → id) do „Ćwicz dalej”. */
  subjects?: { id: string; slug: string }[];
}) {
  const { colors: theme } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const now = new Date();

  const openHistory = (sessionId: string) =>
    navigation.navigate("SessionHistory", { sessionId });

  // Wznowienie Quizu: ta sama sesja (XP i statystyki kumulują się), nowa
  // porcja pytań z tego samego działu bez już rozwiązanych.
  const resumeQuiz = async (it: ActivityItem) => {
    setBusy(it.id);
    try {
      const r = await api<ResumeInfo>(`/sessions/${encodeURIComponent(it.id)}/resume`);
      if (r.status !== "IN_PROGRESS") return openHistory(it.id);
      if (r.listening) {
        // Słuchanie rusza nową sesją (nagrania dobiera serwer na bieżąco).
        return navigation.navigate("ListeningTab");
      }
      const level = r.difficulty
        ? [Math.max(1, r.difficulty - 1), r.difficulty, Math.min(5, r.difficulty + 1)].join(",")
        : undefined;
      const pool = await getQuestions({
        subjectId: r.subject.id,
        ...(r.topic ? { topicIds: r.topic.id } : {}),
        ...(level ? { difficulties: level } : {}),
        exclude: r.answeredQuestionIds.join(",") || undefined,
        shuffle: true,
        limit: 10,
      });
      if (!pool.questions.length) {
        await completeSession(r.id).catch(() => {});
        return openHistory(r.id);
      }
      navigation.navigate("QuizTab", {
        screen: "QuizPlay",
        params: {
          sessionId: r.id,
          questions: pool.questions,
          subjectName: r.subject.name,
          subjectId: r.subject.id,
        },
      });
    } catch (err: any) {
      Alert.alert("Nie udało się wznowić sesji", err?.message || "Spróbuj ponownie.");
    } finally {
      setBusy(null);
    }
  };

  const onPress = (it: ActivityItem): (() => void) | null => {
    const open = it.status === "IN_PROGRESS";
    switch (it.kind) {
      case "quiz":
      case "listening":
        return open ? () => resumeQuiz(it) : () => openHistory(it.id);
      case "exam":
        if (it.status === "GRADING") return null;
        return open
          ? () =>
              navigation.navigate("ExamTab", {
                screen: "ExamPlay",
                params: { examId: it.examId!, subjectId: "" },
              })
          : () =>
              navigation.navigate("ExamTab", {
                screen: "ExamResults",
                params: { attemptId: it.id },
              });
      case "diagnosis":
        return () =>
          navigation.navigate(
            "Diagnosis",
            open ? { subjectSlug: it.subject?.slug } : { token: it.token },
          );
      default:
        return null;
    }
  };

  if (items.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {items.map((it) => {
        const review = it.kind === "quiz" && it.sessionType === "REVIEW";
        const k = review ? { ...KIND.quiz, icon: "🔁", label: "Powtórka" } : KIND[it.kind];
        const open = it.status === "IN_PROGRESS";
        const details = detailsFor(it);
        const showXp = (it.kind === "quiz" || it.kind === "listening") && (it.xpEarned ?? 0) > 0;
        const showPct = !showXp && !open && it.status !== "GRADING" && it.percentage != null;
        // Zakończona sesja z jednego działu (nauka pod sprawdzian) — powrót
        // do tego samego działu jednym dotknięciem.
        const topicSubject =
          it.kind === "quiz" && !open && !review && it.topic?.id
            ? subjects.find((x) => x.slug === it.subject?.slug)
            : undefined;
        const practiceMore = topicSubject
          ? () =>
              navigation.navigate("QuizTab", {
                screen: "QuizSetup",
                params: { subjectId: topicSubject.id, topicId: it.topic!.id },
              })
          : null;
        const press = onPress(it);
        const card = (
          <Card variant="stat">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: k.tint + "1F",
                }}
              >
                <Text style={{ fontSize: 16 }}>{k.icon}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>
                  {titleFor(it)}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                  <Text style={{ fontWeight: "700" }}>{k.label}</Text>
                  {it.subject?.name ? ` · ${it.subject.name}` : ""}
                  {details.map((d) => ` · ${d}`).join("")}
                  {open ? (
                    <Text style={{ color: "#f59e0b", fontWeight: "600" }}>
                      {` · w trakcie — ${it.kind === "exam" || it.kind === "diagnosis" ? "dokończ" : "wznów"}`}
                    </Text>
                  ) : null}
                  {it.status === "GRADING" ? " · ocenianie…" : ""}
                </Text>
                {practiceMore ? (
                  <TouchableOpacity onPress={practiceMore} hitSlop={8} style={{ marginTop: 2 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.brand[500] }}>
                      Ćwicz dalej →
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                {busy === it.id ? (
                  <ActivityIndicator size="small" color={colors.brand[500]} />
                ) : showXp ? (
                  <Badge variant="xp" value={`+${it.xpEarned} XP`} />
                ) : showPct ? (
                  <Text style={{ fontSize: 12, fontWeight: "700", color: theme.text }}>
                    {Math.round(it.percentage!)}%
                  </Text>
                ) : null}
                <Text style={{ fontSize: 11, color: theme.textTertiary }}>{timeAgo(it.at, now)}</Text>
              </View>
            </View>
          </Card>
        );
        return press ? (
          <TouchableOpacity
            key={`${it.kind}-${it.id}`}
            activeOpacity={0.85}
            disabled={busy !== null}
            onPress={press}
          >
            {card}
          </TouchableOpacity>
        ) : (
          <View key={`${it.kind}-${it.id}`}>{card}</View>
        );
      })}
    </View>
  );
}
