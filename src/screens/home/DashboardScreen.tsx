// ============================================================================
// Dashboard Screen — different view for FREE vs PREMIUM
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import { getProfile, type ProfileResponse } from "../../api/gamification";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { getDashboard, type DashboardData } from "../../api/sessions";
import { getSubjects, type Subject } from "../../api/subjects";
import { getActiveExam, type ActiveExamData } from "../../api/exams";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/common/ProgressBar";
import { FreePanel } from "../../components/common/FreePanel";
import { ModeTiles } from "../../components/home/ModeTiles";
import { DashboardUnlockBox } from "../../components/home/DashboardUnlockBox";
import { AccountNote } from "../../components/common/AccountNote";
import { PaymentFailedBanner } from "../../components/common/PaymentFailedBanner";
import { TestimonialPrompt } from "../../components/feedback/TestimonialPrompt";
import { TutorHomeCard } from "../../components/tutor/TutorHomeCard";
import { SprawdzianLektura } from "../../components/common/SprawdzianLektura";
import { SubjectTile } from "../../components/common/SubjectTile";
import {
  RecentActivityList,
  legacyActivity,
} from "../../components/common/RecentActivityList";
import { api } from "../../api/client";
import {
  getNotifications,
  type AppNotification,
} from "../../api/notifications";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark, toggle } = useTheme();
  const { user, isPremium } = useAuth();
  const navigation = useNavigation<any>();

  const [data, setData] = useState<DashboardData | null>(null);
  // „＋ Dodaj przedmiot” — rozwinięta lista przedmiotów spoza panelu.
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  // Przedmiot usunięty z panelu (przytrzymanie) wraca do puli „＋ Dodaj
  // przedmiot” — jak na webie od 26.09.2026, bez osobnej listy „Ukryte”.
  // Backend: SubjectProgress.hiddenAt; kafelek wraca też sam po ćwiczeniu.
  const setSubjectHidden = (slug: string, hidden: boolean) => {
    setData((d) =>
      d
        ? {
            ...d,
            subjectProgress: d.subjectProgress.map((sp) =>
              sp.subject.slug === slug ? { ...sp, hidden } : sp,
            ),
          }
        : d,
    );
    api(`/dashboard/subjects/${encodeURIComponent(slug)}/hide`, {
      method: "POST",
      body: { hidden },
    }).catch(() => {});
  };
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [activeExam, setActiveExam] = useState<ActiveExamData | null>(null);
  // Nieudana płatność Stripe (web). Pobierane razem z resztą; błąd (w tym
  // 404, gdy backend nie ma jeszcze route'u) po prostu nie pokazuje banera.
  const [paymentFailed, setPaymentFailed] = useState<AppNotification | null>(
    null,
  );


  const fetchData = useCallback(async () => {
    try {
      const [
        dashboardData,
        subjectsData,
        profileData,
        activeExamData,
        notificationsData,
        stripeStatus,
      ] = await Promise.all([
        getDashboard().catch(() => null),
        getSubjects().catch(() => []),
        getProfile().catch(() => null),
        getActiveExam().catch(() => null),
        getNotifications().catch(() => null),
        api<{ annualOffer?: { play?: { available?: boolean } } }>("/stripe/status").catch(() => null),
      ]);
      setData(dashboardData);
      setSubjects(subjectsData.filter((s) => s.isActive));
      setProfile(profileData);
      setActiveExam(
        activeExamData && (activeExamData.active || activeExamData.expired)
          ? activeExamData
          : null,
      );
      const list = Array.isArray(notificationsData?.notifications)
        ? notificationsData!.notifications
        : [];
      setPaymentFailed(list.find((n) => n.type === "PAYMENT_FAILED") ?? null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Przy każdym wejściu na Start, nie tylko przy montowaniu: zakładka żyje
  // w tle, więc po oddaniu egzaminu wisiał baner „Egzamin w toku", a cel dnia
  // nie szedł za tym, co uczeń zrobił (zdaj-angielski, 25.09.2026).
  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Imię jest opcjonalne — bez niego początek e-maila (jak w apkach zdaj i osmo),
  // a nie „Witaj 👋 / Cześć”.
  // Nazwa bywa adresem e-mail (rejestracja bez pola imienia) — wtedy część przed „@".
  const firstName = user?.name?.trim().split(/\s+/)[0]?.split("@")[0] || user?.email?.split("@")[0] || "Cześć";

  const activityFeed =
    data?.recentActivity ??
    legacyActivity(data?.recentSessions ?? [], data?.recentExams ?? []);

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
        <Text style={{ fontSize: 16, color: theme.textSecondary }}>
          Ładowanie...
        </Text>
      </View>
    );
  }

  // ── FREE USER VIEW ──────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: spacing[5],
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[500]}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <Text style={{ fontSize: 14, color: theme.textSecondary }}>
              Witaj 👋
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ fontSize: 24, fontWeight: "700", color: theme.text }}
            >
              {firstName}
            </Text>
          </View>
          <TouchableOpacity onPress={toggle}>
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={22}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Uczeń z polecenia korepetytora: zadania na samej górze, reszta
            apki (oferta, FreePanel) zostaje niżej jako zaproszenie. */}
        {user?.hasTutor && <TutorHomeCard />}

        {/* Nieudana płatność — na samej górze, nad ofertą i FreePanel */}
        {paymentFailed && (
          <PaymentFailedBanner
            notification={paymentFailed}
            onDismissed={() => setPaymentFailed(null)}
          />
        )}

        <AccountNote
          account={data?.account}
          onSubscription={() => navigation.navigate("ProfileTab", { screen: "Subscription" })}
        />

        {/* JEDNA karta „Za darmo" (diagnoza, darmowy arkusz, linijka o
            Premium). Wcześniej: duży box „Odblokuj pełny dostęp" z ofertą
            arkusza, ceną i Pakietem, a pod nim drugi raz diagnoza i arkusz
            (zdaj-angielski, 25.09.2026). Przy nieudanej płatności akcję
            przejmuje baner wyżej. */}
        {/* Blok Premium wysoko, jak web PremiumGate „dashboard” (Karol
            28.09.2026) — wcześniej o Premium była tylko drobna linijka na
            dole karty „Za darmo”. Przy nieudanej płatności akcję ma baner. */}
        {!paymentFailed && (
          <DashboardUnlockBox
            onUnlock={() =>
              navigation.navigate("ProfileTab", { screen: "Subscription" })
            }
            subscriptionStatus={user?.subscriptionStatus}
            hasTutor={!!user?.hasTutor}
          />
        )}

        {!paymentFailed && (
          <View style={{ marginBottom: 24 }}>
            <FreePanel
              hidePremiumLine
              onPremium={() =>
                navigation.navigate("ProfileTab", { screen: "Subscription" })
              }
              premiumLabel={
                user?.hasTutor
                  ? "Cały bank pytań poza zadaniami korepetytora:"
                  : "Wszystko bez limitu:"
              }
            />
          </View>
        )}

        {/* Greyed-out subjects */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: theme.text,
            marginBottom: 12,
          }}
        >
          Dostępne przedmioty
        </Text>
        <Text
          style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16 }}
        >
          Wykup Premium, aby uzyskać dostęp
        </Text>

        <View style={{ gap: 10 }}>
          {subjects.map((s) => (
            <View
              key={s.id}
              style={{
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                borderRadius: radius["2xl"],
                padding: spacing[5],
                opacity: 0.5,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.lg,
                    backgroundColor: (s.color || "#6366f1") + "1A",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{s.icon || "📚"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: theme.text,
                    }}
                  >
                    {s.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                    {s._count?.questions || "100+"} pytań
                  </Text>
                </View>
                <Ionicons
                  name="lock-closed"
                  size={18}
                  color={theme.textTertiary}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Bottom CTA */}
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <Button
            title="Zobacz plany Premium"
            onPress={() =>
              navigation.navigate("ProfileTab", { screen: "Subscription" })
            }
            variant="secondary"
            icon={<Ionicons name="diamond" size={16} color="#fff" />}
          />
        </View>
      </ScrollView>
    );
  }

  // ── PREMIUM USER VIEW (existing dashboard) ──────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand[500]}
        />
      }
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, marginRight: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Awatar otwiera Profil — jak w apkach zdaj i osmo (Karol 27.09.2026). */}
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityLabel="Profil"
            onPress={() => navigation.navigate("ProfileTab", { screen: "ProfileMain" })}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.navy[600],
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{ width: 44, height: 44, borderRadius: 22 }}
              />
            ) : (
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
                {(user?.name?.[0] || user?.email?.[0] || "M").toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, color: theme.textSecondary }}>
              Witaj 👋
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ fontSize: 24, fontWeight: "700", color: theme.text, flexShrink: 1 }}
              >
                {firstName}
              </Text>
              {profile?.title && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: profile.title.color + "20",
                    borderWidth: 1,
                    borderColor: profile.title.color + "30",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: profile.title.color,
                    }}
                  >
                    {profile.title.emoji} {profile.title.name}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Sam płomyk z liczbą nic nie znaczył — użytkownicy nie wiedzieli,
              czy to punkty, poziom, czy powiadomienia. Licznik zostaje (seria
              to najmocniejszy mechanizm powracalności), ale po dotknięciu
              tłumaczy, czym jest i jak ją utrzymać. */}
          <TouchableOpacity
            onPress={() => {
              const streak = data?.user.currentStreak || 0;
              Alert.alert(
                "Seria nauki 🔥",
                streak > 0
                  ? `Twoja seria: ${streak} ${streak === 1 ? "dzień" : "dni"} z rzędu.\n\nSeria to liczba kolejnych dni, z choć jednym rozwiązanym pytaniem. Rośnie o 1 każdego dnia nauki i wraca do zera, jeśli opuścisz dzień.\n\nWystarczy jedno pytanie dziennie, żeby ją utrzymać.`
                  : "Seria to liczba kolejnych dni, z choć jednym rozwiązanym pytaniem.\n\nRozwiąż dziś jedno pytanie, a licznik ruszy. Opuszczony dzień zeruje serię — i o to właśnie chodzi: regularność robi wynik na maturze bardziej niż zrywy.",
                [{ text: "Jasne" }],
              );
            }}
            accessibilityLabel="Seria nauki — dotknij, aby dowiedzieć się więcej"
          >
            <Badge
              variant="streak"
              value={`${data?.user.currentStreak || 0}🔥`}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggle}>
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={22}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Nieudana płatność — nad wszystkim innym, dopóki nie zamknie/opłaci */}
      {user?.hasTutor && <TutorHomeCard />}

      {paymentFailed && (
        <PaymentFailedBanner
          notification={paymentFailed}
          onDismissed={() => setPaymentFailed(null)}
        />
      )}

      <AccountNote
        account={data?.account}
        onSubscription={() => navigation.navigate("ProfileTab", { screen: "Subscription" })}
      />

      {/* ═══ ACTIVE EXAM RESUME — duży amber banner ═══ */}
      {activeExam?.active && !activeExam.expired && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            // Kilka arkuszy w toku (od 26.09.2026) → lista „W toku”
            // zamiast wybierania za ucznia jednego z nich.
            (activeExam.attempts?.length ?? 1) > 1
              ? navigation.navigate("ExamTab", {
                  screen: "ExamSelector",
                  params: { noAutoOpen: true },
                })
              : navigation.navigate("ExamTab", {
                  screen: "ExamPlay",
                  params: { examId: activeExam.examId!, subjectId: "" },
                })
          }
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 20,
            backgroundColor: isDark ? "#78350f30" : "#fef3c7",
            borderWidth: 2,
            borderColor: "#f59e0b",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#ef4444",
              }}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                color: "#dc2626",
                letterSpacing: 0.5,
              }}
            >
              {(activeExam.attempts?.length ?? 1) > 1
                ? `${activeExam.attempts!.length} ${activeExam.attempts!.length % 10 >= 2 && activeExam.attempts!.length % 10 <= 4 && (activeExam.attempts!.length % 100 < 10 || activeExam.attempts!.length % 100 >= 20) ? "ARKUSZE" : "ARKUSZY"} W TOKU`
                : "EGZAMIN W TOKU"}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: isDark ? "#fbbf24" : "#92400e",
              marginBottom: 4,
            }}
          >
            {activeExam.examTitle}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isDark ? "#fcd34d" : "#78350f",
              marginBottom: 8,
            }}
          >
            ⏱{" "}
            {Math.floor((activeExam.remainingMinutes || 0) / 60) > 0
              ? `${Math.floor((activeExam.remainingMinutes || 0) / 60)} godz. `
              : ""}
            {(activeExam.remainingMinutes || 0) % 60} min •{" "}
            {activeExam.answeredCount || 0} odpowiedzi
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: "#d97706",
            }}
          >
            Kontynuuj egzamin →
          </Text>
        </TouchableOpacity>
      )}

      {activeExam?.expired && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("ExamTab", {
              screen: "ExamResults",
              params: { attemptId: activeExam.attemptId! },
            })
          }
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 20,
            backgroundColor: isDark ? "#5b21b620" : "#f5f3ff",
            borderWidth: 1,
            borderColor: isDark ? "#7c3aed40" : "#ddd6fe",
          }}
        >
          <Text style={{ fontSize: 26, marginBottom: 4 }}>⏰</Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: isDark ? "#c4b5fd" : "#5b21b6",
            }}
          >
            Czas egzaminu minął
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isDark ? "#a78bfa" : "#6d28d9",
              marginTop: 4,
            }}
          >
            Zobacz wyniki →
          </Text>
        </TouchableOpacity>
      )}

      {/* Prośba o opinię przy serii (≥ 2 dni, jak na webie) — moment, w którym
          uczniowi faktycznie idzie. Komponent sam sprawdza, czy konto już pytano. */}
      {(data?.user.currentStreak || 0) >= 2 && (
        <TestimonialPrompt
          trigger="streak"
          context={{ streakDays: data?.user.currentStreak }}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* ═══ WYBIERZ TRYB — Egzamin Live / Quiz / Słuchanie ═══
          Jednakowe karty jak web „Wybierz tryb” (components/home/ModeTiles).
          Cele bez zmian: Egzamin → zakładka Egzamin, Quiz → zakładka Quiz
          (trwający quiz wraca, bez niego — nowa sesja), Słuchanie → hub. */}
      <ModeTiles
        onExam={() => navigation.navigate("ExamTab")}
        onQuiz={() => navigation.navigate("QuizTab")}
        onListening={() => navigation.navigate("ListeningHub")}
      />

      {/* Twoje przedmioty — zaraz pod trybami, nad statystykami (jak na webie) */}
      {data?.subjectProgress && data.subjectProgress.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.text,
              marginBottom: 12,
            }}
          >
            Twoje przedmioty
          </Text>
          <View style={{ gap: 12 }}>
            {(() => {
              // Sortuj po recentSessions (jak na webie)
              const orderMap = new Map<string, number>();
              (data.recentSessions || []).forEach((s) => {
                if (!orderMap.has(s.subject.slug)) {
                  orderMap.set(s.subject.slug, orderMap.size);
                }
              });
              // Ostatnio ćwiczone (albo świeżo dodane) na górze — jak na webie.
              const at = (x: any) =>
                Math.max(
                  0,
                  ...[x.quiz?.lastAnsweredAt, x.lastSessionAt, x.addedAt]
                    .filter(Boolean)
                    .map((d: string) => new Date(d).getTime()),
                );
              return data.subjectProgress.filter((sp) => !sp.hidden).sort((a, b) => {
                const d = at(b) - at(a);
                if (d !== 0) return d;
                const aO = orderMap.get(a.subject.slug) ?? 999;
                const bO = orderMap.get(b.subject.slug) ?? 999;
                if (aO !== bO) return aO - bO;
                return b.questionsAnswered - a.questionsAnswered;
              });
            })().map((sp) => {
              // Znajdź subject ID z listy subjects
              const subjectObj = subjects.find(
                (s) => s.slug === sp.subject.slug,
              );
              return (
                <SubjectTile
                  key={sp.subject.slug}
                  sp={sp as any}
                  canRemove={data.subjectProgress.filter((x) => !x.hidden).length > 1}
                  onRemove={() => setSubjectHidden(sp.subject.slug, true)}
                  onQuiz={() => {
                    if (subjectObj) {
                      navigation.navigate("QuizTab", {
                        screen: "QuizSetup",
                        params: { subjectId: subjectObj.id },
                      });
                    }
                  }}
                  onExam={() =>
                    navigation.navigate("ExamTab", {
                      screen: "ExamSelector",
                      params: { subjectSlug: sp.subject.slug },
                    })
                  }
                  onListening={
                    subjectObj && ["angielski", "niemiecki"].includes(sp.subject.slug)
                      ? () =>
                          navigation.navigate("QuizTab", {
                            screen: "QuizPlay",
                            params: {
                              sessionId: "__listening__",
                              questions: [],
                              subjectName: subjectObj.name,
                              subjectId: subjectObj.id,
                              questionTypes: ["LISTENING"],
                            },
                          })
                      : undefined
                  }
                />
              );
            })}
          </View>
          {(() => {
            const shown = new Set(
              data.subjectProgress.filter((sp) => !sp.hidden).map((sp) => sp.subject.slug),
            );
            const others = subjects.filter((s) => !shown.has(s.slug));
            if (others.length === 0) return null;
            const add = async (slug: string) => {
              setAdding(slug);
              try {
                await api(`/dashboard/subjects/${encodeURIComponent(slug)}/add`, {
                  method: "POST",
                  body: {},
                });
                setAddOpen(false);
                await fetchData();
              } catch (err: any) {
                Alert.alert("Błąd", err.message || "Nie udało się dodać przedmiotu.");
              } finally {
                setAdding(null);
              }
            };
            return (
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setAddOpen((v) => !v)}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: theme.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: theme.textSecondary }}>
                    {addOpen ? "− Zamknij" : "＋ Dodaj przedmiot"}
                  </Text>
                </TouchableOpacity>
                {addOpen && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {others.map((s) => (
                      <TouchableOpacity
                        key={s.slug}
                        disabled={adding !== null}
                        onPress={() => add(s.slug)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: 12,
                          backgroundColor: theme.inputBg,
                          opacity: adding !== null && adding !== s.slug ? 0.5 : 1,
                        }}
                      >
                        <Text>{s.icon || "📚"}</Text>
                        <Text style={{ fontSize: 13, color: theme.text }}>
                          {adding === s.slug ? "Dodaję…" : s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {!addOpen && data.subjectProgress.filter((sp) => !sp.hidden).length > 1 && (
                  <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 8 }}>
                    ✕ usuwa przedmiot z panelu — wróci przez „＋ Dodaj przedmiot”.
                  </Text>
                )}
              </View>
            );
          })()}
        </View>
      )}

      {/* Sprawdzian z lektury / epoki — pod przedmiotami, jak na webie */}
      <SprawdzianLektura
        subject={subjects.find((s) => s.slug === "polski") as any}
        navigation={navigation}
      />

      {/* Stats row */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        <Card variant="stat" style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>XP</Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: theme.primaryText,
              marginTop: 2,
            }}
          >
            {data?.user.totalXp || 0}
          </Text>
        </Card>
        <Card variant="stat" style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>
            Poziom
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: theme.secondaryText,
              marginTop: 2,
            }}
          >
            {data?.user.globalLevel || 1}
          </Text>
        </Card>
      </View>

      {/* Daily goal */}
      {data?.today && (
        <Card
          style={{
            marginBottom: 20,
            backgroundColor: isDark ? theme.card : "#FFFFFF",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "600", color: theme.text }}
            >
              Cel dnia
            </Text>
            {data.today.isCompleted && (
              <Badge variant="xp" value="✅ Zrobione!" />
            )}
          </View>
          <View style={{ gap: 12 }}>
            <View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  Pytania
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: theme.text }}
                >
                  {data.today.questionsCompleted}/{data.today.targetQuestions}
                </Text>
              </View>
              <ProgressBar
                progress={
                  (data.today.questionsCompleted / data.today.targetQuestions) *
                  100
                }
                height={6}
              />
            </View>
            <View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  XP
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: theme.text }}
                >
                  {data.today.xpEarned}/{data.today.targetXp}
                </Text>
              </View>
              <ProgressBar
                progress={(data.today.xpEarned / data.today.targetXp) * 100}
                height={6}
                color={colors.navy[500]}
              />
            </View>
          </View>
        </Card>
      )}

      {/* Next badge hint */}
      {data?.recentAchievements && data.recentAchievements.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("ProfileTab", { screen: "Badges" })
          }
        >
          <Card
            style={{
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.yellow[500] + "30",
              backgroundColor: isDark
                ? colors.yellow[500] + "08"
                : colors.yellow[500] + "08",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text style={{ fontSize: 28 }}>
                {data.recentAchievements[0].icon}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: colors.yellow[500],
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Ostatnia odznaka
                </Text>
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: theme.text }}
                >
                  {data.recentAchievements[0].name}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                  {data.recentAchievements[0].description}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.textTertiary}
              />
            </View>
          </Card>
        </TouchableOpacity>
      )}

      {/* Ostatnia aktywność — Quiz, słuchanie, arkusze, wypracowania,
          diagnoza w jednym feedzie; każdy kafelek prowadzi dalej
          (RecentActivityList). Starszy backend: recentSessions + recentExams. */}
      {activityFeed.length > 0 && (
        <View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.text,
              marginBottom: 12,
            }}
          >
            Ostatnia aktywność
          </Text>
          <View style={{ gap: 8 }}>
            <RecentActivityList
              items={activityFeed}
              navigation={navigation}
              subjects={subjects}
            />
            {/* Link do pełnej historii */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate("SessionHistory")}
              style={{ alignItems: "center", marginTop: 8 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: colors.brand[500] + "0D",
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={colors.brand[500]}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.brand[500],
                  }}
                >
                  Pełna historia sesji
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.brand[500]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
