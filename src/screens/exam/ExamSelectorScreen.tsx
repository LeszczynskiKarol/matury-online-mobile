// src/screens/exam/ExamSelectorScreen.tsx

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { PremiumGate } from "../../components/common/PremiumGate";
import { AdminExamList } from "../../components/exam/AdminExamList";
import { colors } from "../../theme/colors";
import { api } from "../../api/client";
import {
  getActiveExam,
  getAvailableExams,
  type ActiveExamData,
  type InProgressAttempt,
  discardExam,
  type ExamInfo,
  type SubjectExamAvailability,
} from "../../api/exams";
import { getTrialStatus, type TrialStatus } from "../../api/premium";
import { radius } from "../../theme";
import type { ExamStackParamList } from "../../navigation/types";
import { handlePremiumError } from "../../lib/premiumAlert";

type Nav = NativeStackNavigationProp<ExamStackParamList>;

interface SubjectExamInfo {
  subjectId: string;
  subjectName: string;
  subjectIcon: string;
  subjectSlug: string;
  level: string;
  unseenCount: number;
  completedCount: number;
  timeMinutes: number;
  maxPoints: number;
}

export function ExamSelectorScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  // Wejście z kafla przedmiotu na pulpicie (?przedmiot= na webie): lista
  // zawężona do jednego przedmiotu, „Wszystkie przedmioty →” zdejmuje filtr.
  const paramSlug: string | undefined = route.params?.subjectSlug;
  const noAutoOpen: boolean = !!route.params?.noAutoOpen;
  const [subjectFilter, setSubjectFilter] = useState<string | null>(paramSlug ?? null);
  // Auto-otwarcie arkusza przy jednym poziomie — raz na wejście z pulpitu.
  const autoOpened = useRef(false);
  useEffect(() => {
    setSubjectFilter(paramSlug ?? null);
    autoOpened.current = false;
  }, [paramSlug]);
  // Przedmioty, które uczeń już ćwiczy (postęp na pulpicie) — na górę.
  const [mySlugs, setMySlugs] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [activeExam, setActiveExam] = useState<ActiveExamData | null>(null);
  // Wszystkie arkusze w toku — od 26.09.2026 wolno kilka naraz (jak na webie),
  // lista „W toku” nad katalogiem zamiast blokady.
  const [inProgress, setInProgress] = useState<InProgressAttempt[]>([]);
  // „Porzuć” wymaga drugiego dotknięcia.
  const [discardArmed, setDiscardArmed] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [examInfos, setExamInfos] = useState<SubjectExamInfo[]>([]);
  const [selectedSubject, setSelectedSubject] =
    useState<SubjectExamInfo | null>(null);
  const [examList, setExamList] = useState<ExamInfo[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [trial, setTrial] = useState<TrialStatus | null>(null);

  // Check premium + active exam + subjects
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setActiveExam(null); // ← reset on every focus

      (async () => {
        try {
          const [status, trialStatus] = await Promise.all([
            api<{ isPremium: boolean }>("/stripe/status"),
            getTrialStatus().catch(() => null),
          ]);
          if (cancelled) return;
          setIsPremium(status.isPremium);
          setTrial(trialStatus);

          // Oferta próbna daje dostęp do katalogu i JEDNEGO arkusza. Gdy
          // arkusz jest już przypięty (examId), katalog w ogóle się nie
          // renderuje — więc nie ma po co go pobierać.
          const trialAccess =
            !!trialStatus && (trialStatus.active || !!trialStatus.examId);
          if (!status.isPremium && (!trialAccess || trialStatus!.examId)) {
            setLoading(false);
            return;
          }

          // Active exam
          const active = await getActiveExam();
          if (cancelled) return;
          setInProgress(
            active.attempts ?? (active.active ? [active as any] : []),
          );
          if (active.expired) {
            setActiveExam({ ...active, expired: true } as any);
          }

          // Subjects + order + moje przedmioty równolegle
          const [subs, orderRes, dash] = await Promise.all([
            api<any[]>("/subjects"),
            api<{ order: string[] }>("/exams/subjects-order").catch(() => ({
              order: [] as string[],
            })),
            api<any>("/dashboard").catch(() => null),
          ]);
          if (cancelled) return;
          setMySlugs(
            (dash?.subjectProgress ?? [])
              .filter((sp: any) => !sp.hidden)
              .map((sp: any) => sp.subject.slug),
          );

          // Wszystkie kombinacje przedmiot × poziom równolegle
          const checks = subs.flatMap((sub: any) =>
            (["PODSTAWOWY", "ROZSZERZONY"] as const).map((level) =>
              getAvailableExams(sub.id, level)
                .then((avail) =>
                  avail.available
                    ? ({
                        subjectId: sub.id,
                        subjectName: sub.name,
                        subjectIcon: sub.icon || "📝",
                        subjectSlug: sub.slug,
                        level,
                        unseenCount: avail.unseenCount,
                        completedCount: avail.completedCount,
                        timeMinutes: avail.timeMinutes,
                        maxPoints: avail.maxPoints,
                      } as SubjectExamInfo)
                    : null,
                )
                .catch(() => null),
            ),
          );

          const results = await Promise.all(checks);
          if (cancelled) return;

          const order = orderRes.order || [];
          const sorted = (results.filter(Boolean) as SubjectExamInfo[]).sort(
            (a, b) => {
              const iA = order.indexOf(a.subjectSlug);
              const iB = order.indexOf(b.subjectSlug);
              const subA = iA === -1 ? 99 : iA;
              const subB = iB === -1 ? 99 : iB;
              if (subA !== subB) return subA - subB;
              return a.level === "PODSTAWOWY" ? -1 : 1;
            },
          );
          setExamInfos(sorted);
        } catch (err: any) {
          console.error(err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleSubjectClick = async (info: SubjectExamInfo) => {
    // Ten przedmiot i poziom ma już arkusz w toku → wracamy do niego.
    const running = inProgress.find(
      (a) => a.subjectSlug === info.subjectSlug && a.level === info.level,
    );
    if (running) {
      navigation.navigate("ExamPlay", {
        examId: running.examId,
        subjectId: info.subjectId,
      });
      return;
    }
    setLoadingExams(true);
    try {
      const data = await getAvailableExams(info.subjectId, info.level);
      // Weź pierwszy niewidziany, fallback na pierwszy z listy (jak desktop).
      // Darmowy arkusz z oferty: NAJNOWSZY (nowe arkusze są najlepsze), a nie #1,
      // który dostawał każdy uczeń z oferty.
      const pool: any[] = data.exams || [];
      const unseen = pool.filter((e: any) => !e.completed);
      const newest = (list: any[]) =>
        list.reduce((m: any, e: any) => (!m || (e.examNumber ?? 0) > (m.examNumber ?? 0) ? e : m), null);
      const exam =
        isPremium === false && trial?.active
          ? newest(unseen) || newest(pool)
          : unseen[0] || pool[0];

      if (exam) {
        navigation.navigate("ExamPlay", {
          examId: exam.id,
          subjectId: info.subjectId,
        });
        return;
      }

      // Brak arkuszy — pokaż komunikat "AI generuje"
      setSelectedSubject(info);
      setExamList([]);
    } catch (err: any) {
      if (handlePremiumError(err, navigation)) return;
      Alert.alert("Błąd", err.message);
    } finally {
      setLoadingExams(false);
    }
  };

  // Kafel przedmiotu z pulpitu, przedmiot z jednym poziomem (np. fizyka PR):
  // nie ma czego wybierać — od razu arkusz (jak na webie).
  useEffect(() => {
    if (loading || autoOpened.current || noAutoOpen || !subjectFilter) return;
    if (isPremium !== true) return;
    const lv = examInfos.filter((i) => i.subjectSlug === subjectFilter);
    if (lv.length !== 1) return;
    autoOpened.current = true;
    void handleSubjectClick(lv[0]);
  }, [loading, examInfos, subjectFilter, noAutoOpen, isPremium]);

  const onDiscard = async (attemptId: string) => {
    if (discardArmed !== attemptId) {
      setDiscardArmed(attemptId);
      setTimeout(() => setDiscardArmed((v) => (v === attemptId ? null : v)), 4000);
      return;
    }
    setDiscarding(attemptId);
    try {
      await discardExam(attemptId);
      setInProgress((l) => l.filter((a) => a.attemptId !== attemptId));
    } catch (err: any) {
      Alert.alert("Błąd", err.message);
    } finally {
      setDiscarding(null);
      setDiscardArmed(null);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.brand[500]} />
      </View>
    );
  }

  // Arkusz z oferty próbnej już przypięty — pokazujemy WYŁĄCZNIE jego.
  // Katalog pozostałych arkuszy byłby listą rzeczy, których nie da się
  // otworzyć (backend odbija je 403), a user i tak nie wiedziałby, który
  // wybrał.
  if (isPremium === false && trial?.examId) {
    const done =
      trial.attemptStatus === "COMPLETED" || trial.attemptStatus === "GRADING";
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 100,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text }}>
          Twój darmowy arkusz
        </Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 18 }}>
          W ramach oferty masz jeden arkusz — ten poniżej.
        </Text>

        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: radius["2xl"],
            borderWidth: 2,
            borderColor: colors.brand[500] + "66",
            padding: 18,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <View
              style={{
                backgroundColor: colors.brand[500],
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>
                DARMOWY
              </Text>
            </View>
            {done && (
              <View
                style={{
                  backgroundColor: colors.navy[500],
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>
                  ODDANY
                </Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text }}>
            {trial.exam?.title ?? "Arkusz maturalny"}
          </Text>
          {trial.exam && (
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
              {trial.exam.subjectName} · poziom {trial.exam.level.toLowerCase()} ·{" "}
              bez limitu czasu · {trial.exam.maxPoints} pkt
            </Text>
          )}

          <TouchableOpacity
            onPress={() => {
              if (done && trial.examAttemptId) {
                navigation.navigate("ExamResults", {
                  attemptId: trial.examAttemptId,
                });
              } else {
                navigation.navigate("ExamPlay", {
                  examId: trial.examId!,
                  subjectId: "",
                });
              }
            }}
            style={{
              backgroundColor: colors.brand[500],
              paddingVertical: 13,
              borderRadius: radius.xl,
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {done ? "Zobacz wynik i feedback AI →" : "Wróć do arkusza →"}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: theme.backgroundSecondary,
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginTop: 18,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Pozostałe arkusze — ze wszystkich przedmiotów, bez limitu podejść —
            odblokujesz w Premium.
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.getParent()?.navigate("ProfileTab", {
                screen: "Subscription",
              })
            }
            style={{
              backgroundColor: colors.brand[500],
              paddingVertical: 11,
              paddingHorizontal: 22,
              borderRadius: radius.xl,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
              Zobacz Premium →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Premium gate — wcześniej bez ŻADNEGO CTA (ślepa uliczka); teraz wspólny
  // konwersyjny ekran z przejściem do subskrypcji. Konto z ważną ofertą
  // przechodzi dalej, do katalogu.
  if (isPremium === false && !trial?.active) {
    return <PremiumGate mode="exam" />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 100,
      }}
    >
      {/* Header */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.text,
          marginBottom: 4,
        }}
      >
        Egzamin Live 📝
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: theme.textSecondary,
          marginBottom: 24,
          lineHeight: 21,
        }}
      >
        {isPremium === false && !!trial && (trial.active || !!trial.examId)
          ? "Pełny arkusz maturalny z punktacją wg klucza i feedbackiem AI. Twój darmowy arkusz nie ma limitu czasu."
          : "Pełny symulator matury. Timer, arkusz, feedback AI."}
      </Text>

      {/* Oferta ważna, arkusz jeszcze nie wybrany. Ostrzeżenie jest istotne:
          wybór jest JEDNORAZOWY, a bez tej informacji uczeń klika w pierwszy
          z brzegu i orientuje się dopiero, gdy nie może otworzyć drugiego. */}
      {isPremium === false && trial?.active && !trial.examId && (
        <View
          style={{
            padding: 14,
            borderRadius: radius["2xl"],
            backgroundColor: colors.brand[500] + "14",
            borderWidth: 1,
            borderColor: colors.brand[500] + "55",
            marginBottom: 18,
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: "800", color: theme.text, marginBottom: 4 }}
          >
            🎁 Masz odblokowany 1 darmowy arkusz
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }}>
            Wybierz dowolny arkusz poniżej — <Text style={{ fontWeight: "800" }}>to wybór
            na raz</Text>, więc weź przedmiot, na którym najbardziej Ci zależy. Masz też{" "}
            {trial.credits} kredytów AI na ocenę zadań otwartych.
          </Text>
        </View>
      )}

      {/* W toku — rozpoczęte arkusze (może być kilka) */}
      {inProgress.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#ef4444" }} />
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#dc2626", letterSpacing: 0.5 }}>
              W TOKU ({inProgress.length})
            </Text>
          </View>
          {inProgress.map((a) => {
            const h = Math.floor(a.remainingMinutes / 60);
            const time = a.untimed
              ? "bez limitu czasu"
              : `⏱ zostało ${h > 0 ? `${h} godz. ` : ""}${a.remainingMinutes % 60} min`;
            const n = a.answeredCount;
            const answers =
              n === 0
                ? "bez odpowiedzi"
                : `${n} ${n === 1 ? "odpowiedź" : "odpowiedzi"}`;
            const armed = discardArmed === a.attemptId;
            return (
              <View
                key={a.attemptId}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: "#fef3c7",
                  borderWidth: 1.5,
                  borderColor: "#fbbf24",
                  marginBottom: 10,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("ExamPlay", { examId: a.examId, subjectId: "" })
                  }
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Text style={{ fontSize: 24 }}>{a.subjectIcon || "📝"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: "#92400e" }}>
                      {a.examTitle}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: !a.untimed && a.remainingMinutes < 30 ? "#dc2626" : "#78350f",
                        marginTop: 2,
                      }}
                    >
                      {time} · {answers}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={() => onDiscard(a.attemptId)}
                    disabled={discarding === a.attemptId}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: armed ? "#dc2626" : "transparent",
                      opacity: discarding === a.attemptId ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: armed ? "#fff" : "#a16207" }}>
                      {discarding === a.attemptId ? "Porzucam…" : armed ? "Na pewno porzucić?" : "Porzuć"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("ExamPlay", { examId: a.examId, subjectId: "" })
                    }
                    style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#f59e0b" }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>Kontynuuj →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>
            Odpowiedzi zapisują się same. Gdy czas arkusza minie, zostanie oddany i oceniony automatycznie.
          </Text>
        </View>
      )}

      {/* Expired exam */}
      {activeExam?.expired && (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ExamResults", {
              attemptId: activeExam.attemptId!,
            })
          }
          style={{
            padding: 20,
            borderRadius: 20,
            backgroundColor: "#f5f3ff",
            borderWidth: 1,
            borderColor: "#ddd6fe",
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 32, marginBottom: 8 }}>⏰</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#5b21b6" }}>
            Czas egzaminu minął
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: "#6d28d9",
              marginTop: 4,
              lineHeight: 20,
            }}
          >
            Arkusz został oddany automatycznie — wynik czeka w wynikach.
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: "#7c3aed",
              marginTop: 12,
            }}
          >
            Zobacz wyniki →
          </Text>
        </TouchableOpacity>
      )}

      {/* Katalog zawsze widoczny — arkusze w toku go nie blokują */}
      {(
        <>
          {/* Subject selection — jedna karta na przedmiot, poziomy jako
              przyciski w karcie; „Twoje przedmioty” na górze (jak web). */}
          {!selectedSubject && (() => {
            const list = subjectFilter
              ? examInfos.filter((i) => i.subjectSlug === subjectFilter)
              : examInfos;
            const bySubject = new Map<string, SubjectExamInfo[]>();
            for (const info of list) {
              const arr = bySubject.get(info.subjectSlug) ?? [];
              arr.push(info);
              bySubject.set(info.subjectSlug, arr);
            }
            const groups = [...bySubject.values()];
            const mine = groups.filter((g) => mySlugs.includes(g[0].subjectSlug));
            const rest = groups.filter((g) => !mySlugs.includes(g[0].subjectSlug));
            const arkuszy = (n: number) =>
              n === 1
                ? "arkusz"
                : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
                  ? "arkusze"
                  : "arkuszy";
            const card = (g: SubjectExamInfo[]) => {
              const head = g[0];
              const unseen = g.reduce((a, x) => a + (x.unseenCount || 0), 0);
              const done = g.reduce((a, x) => a + (x.completedCount || 0), 0);
              return (
                <View
                  key={head.subjectSlug}
                  style={{
                    padding: 16,
                    borderRadius: 20,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: 28 }}>{head.subjectIcon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
                        {head.subjectName}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                        {unseen} {arkuszy(unseen)} do zrobienia
                        {done > 0 ? ` · ✓ ${done} zrobione` : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    {g.map((info) => {
                      const pr = info.level === "ROZSZERZONY";
                      return (
                        <TouchableOpacity
                          key={info.level}
                          disabled={loadingExams}
                          onPress={() => handleSubjectClick(info)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: pr ? "#a855f766" : "#0ea5e966",
                            backgroundColor: pr ? "#a855f714" : "#0ea5e914",
                            opacity: loadingExams ? 0.6 : 1,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "700", color: pr ? "#a855f7" : "#0ea5e9" }}>
                            {pr ? "Rozszerzony" : "Podstawowy"}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                            {info.timeMinutes} min · {info.maxPoints} pkt →
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            };
            const label = (t: string) => (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                  color: theme.textTertiary,
                  marginBottom: 10,
                  marginTop: 4,
                }}
              >
                {t}
              </Text>
            );
            return (
              <>
                {subjectFilter && groups.length > 0 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, flexShrink: 1 }}>
                      {groups[0][0].subjectIcon} {groups[0][0].subjectName} — wybierz poziom
                    </Text>
                    <TouchableOpacity onPress={() => setSubjectFilter(null)} hitSlop={8}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.brand[500] }}>
                        Wszystkie przedmioty →
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 12 }}>
                    Wybierz przedmiot
                  </Text>
                )}

                {examInfos.length === 0 && (
                  <View
                    style={{
                      padding: 32,
                      alignItems: "center",
                      backgroundColor: theme.card,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>🚧</Text>
                    <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                      Egzamin Live będzie dostępny wkrótce.
                    </Text>
                  </View>
                )}

                {subjectFilter || mine.length === 0 ? (
                  groups.map(card)
                ) : (
                  <>
                    {label("TWOJE PRZEDMIOTY")}
                    {mine.map(card)}
                    {rest.length > 0 && (
                      <>
                        {label("POZOSTAŁE PRZEDMIOTY")}
                        {rest.map(card)}
                      </>
                    )}
                  </>
                )}
              </>
            );
          })()}

          {/* Exam list */}
          {selectedSubject && (
            <>
              <TouchableOpacity
                onPress={() => {
                  setSelectedSubject(null);
                  setExamList([]);
                }}
                style={{ marginBottom: 16 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    fontWeight: "600",
                  }}
                >
                  ← Zmień przedmiot
                </Text>
              </TouchableOpacity>

              {loadingExams ? (
                <ActivityIndicator
                  size="small"
                  color={colors.brand[500]}
                  style={{ marginTop: 32 }}
                />
              ) : examList.length === 0 ? (
                <View
                  style={{
                    padding: 32,
                    alignItems: "center",
                    backgroundColor: theme.card,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>✨</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: theme.textSecondary,
                      textAlign: "center",
                    }}
                  >
                    AI generuje nowe arkusze. Odśwież za chwilę.
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: theme.text,
                      marginBottom: 12,
                    }}
                  >
                    Dostępne arkusze
                  </Text>
                  {examList.map((exam) => (
                    <TouchableOpacity
                      key={exam.id}
                      onPress={() =>
                        navigation.navigate("ExamPlay", {
                          examId: exam.id,
                          subjectId: selectedSubject.subjectId,
                        })
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: theme.card,
                        borderWidth: 1,
                        borderColor: theme.borderLight,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          backgroundColor: colors.navy[500] + "15",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "800",
                            color: colors.navy[500],
                          }}
                        >
                          #{exam.examNumber}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: theme.text,
                          }}
                        >
                          {exam.title}
                        </Text>
                        <Text
                          style={{ fontSize: 12, color: theme.textSecondary }}
                        >
                          {exam.timeMinutes} min • {exam.maxPoints} pkt
                        </Text>
                      </View>
                      <Ionicons
                        name="play-circle"
                        size={28}
                        color={colors.brand[500]}
                      />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}

          {/* Pełna lista arkuszy — wchodzi także w te nieaktywne i już
              rozwiązane, których widok ucznia nie pokazuje. */}
          <AdminExamList
            onOpen={(examId) =>
              navigation.navigate("ExamPlay", { examId, subjectId: "" })
            }
          />

          {/* History link */}
          <TouchableOpacity
            onPress={() => navigation.navigate("ExamHistory")}
            style={{ alignItems: "center", marginTop: 24 }}
          >
            <Text
              style={{
                fontSize: 13,
                color: theme.textTertiary,
              }}
            >
              📜 Historia egzaminów
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
