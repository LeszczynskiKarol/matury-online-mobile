// ============================================================================
// ListeningHubScreen — wybór języka dla listeningu, deep-link do QuizTab
// ============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { getFreeStatus, type FreeStatus } from "../../api/freeStatus";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { PremiumGate } from "../../components/common/PremiumGate";
import { subjectsApi } from "../../api";
import type { Subject } from "../../api/subjects";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";

const LANG_SLUGS = ["angielski", "niemiecki"];
const LANG_META: Record<
  string,
  { flag: string; name: string; subtitle: string }
> = {
  angielski: {
    flag: "🇬🇧",
    name: "Angielski",
    subtitle: "Listening po angielsku",
  },
  niemiecki: {
    flag: "🇩🇪",
    name: "Niemiecki",
    subtitle: "Hörverstehen na niemiecki",
  },
};

export function ListeningHubScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { isPremium } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  // Konto FREE (od 5.10.2026): 3 darmowe nagrania. undefined = wczytuję.
  const [free, setFree] = useState<FreeStatus["listening"] | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      if (isPremium) return;
      getFreeStatus()
        .then((st) => setFree(st.listening))
        .catch(() => setFree(null));
    }, [isPremium]),
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await subjectsApi.getSubjects();
        setSubjects(
          data.filter((s) => s.isActive && LANG_SLUGS.includes(s.slug)),
        );
      } catch {}
      setLoading(false);
    })();
  }, []);

  const startListening = (subject: Subject) => {
    // Pomijamy QuizSetup — od razu QuizPlay z trybem LISTENING.
    // Sesja "__listening__" sygnalizuje QuizPlay żeby użył listening API.
    // Konto FREE: backend sam daje darmową sesję (albo jej przegląd).
    navigation.navigate("QuizTab", {
      screen: "QuizPlay",
      // Nad ekranem startowym Quizu, nie zamiast niego (inaczej po wyjściu
      // zakładka Quiz zostawała na Słuchaniu).
      initial: false,
      params: {
        // Unikalne id ekranu: każde wejście to świeży odtwarzacz (getId
        // w QuizStack), a nie stary ekran z poprzednim stanem.
        sessionId: `__listening__:${Date.now()}`,
        questions: [],
        subjectName: subject.name,
        subjectId: subject.id,
        questionTypes: ["LISTENING"],
      },
    });
  };

  // Zaczęta darmowa sesja otwiera się od razu (jak web, Karol 5.10.2026).
  useEffect(() => {
    if (isPremium || free?.state !== "in_progress" || subjects.length === 0) return;
    const s = subjects.find((x) => x.slug === free.subjectSlug) ?? subjects[0];
    startListening(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, free, subjects]);

  if (!isPremium) {
    if (free === undefined || free?.state === "in_progress" || loading) {
      return (
        <View style={{ flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      );
    }
    // Wykorzystane: bramka + powrót do swoich nagrań (przegląd z oceną).
    if (free?.state === "used") {
      // Karta w nagłówku bramki — przewija się razem z nią (stała nad
      // ScrollView wyglądała, jakby bramka pod nią wjeżdżała).
      return (
        <PremiumGate
          mode="listening"
          header={
          <TouchableOpacity
            onPress={() => {
              const s = subjects.find((x) => x.slug === free.subjectSlug) ?? subjects[0];
              if (s) startListening(s);
            }}
            style={{
              marginBottom: spacing[4],
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.card,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
              🎧 Twoje darmowe nagrania
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
              Nagrania z Twoimi odpowiedziami i oceną zostają na stałe.
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.brand[500], marginTop: 8 }}>
              Wróć do swoich nagrań →
            </Text>
          </TouchableOpacity>
          }
        />
      );
    }
    // Bez pakietu startowego albo błąd — jak dotąd bramka.
    if (free?.state !== "available") return <PremiumGate mode="listening" />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        {/* Ekran jest teraz korzeniem własnej zakładki, a nie podstroną
            dashboardu — wtedy nie ma dokąd wracać i strzałka tylko myli. */}
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </TouchableOpacity>
        )}
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: theme.text,
            flex: 1,
          }}
        >
          Listening 🎧
        </Text>
      </View>
      <Text
        style={{
          fontSize: 14,
          color: theme.textSecondary,
          marginBottom: 24,
          lineHeight: 21,
        }}
      >
        Wybierz język — nagrania i zadania są jak na maturze.
      </Text>
      {!isPremium && (
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: -12,
            marginBottom: 18,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? "#6ee7b7" : "#047857" }}>
            3 nagrania za darmo · wybierz język
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.brand[500]}
          style={{ marginTop: 40 }}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {subjects.map((s) => {
            const meta = LANG_META[s.slug];
            if (!meta) return null;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.85}
                onPress={() => startListening(s)}
                style={{
                  padding: 18,
                  borderRadius: 20,
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    backgroundColor: (s.color || colors.brand[500]) + "20",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 30 }}>{meta.flag}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "800",
                      color: theme.text,
                    }}
                  >
                    {meta.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {meta.subtitle}
                  </Text>
                </View>
                <Ionicons
                  name="play-circle"
                  size={32}
                  color={colors.brand[500]}
                />
              </TouchableOpacity>
            );
          })}

          {/* Info card */}
          <View
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 16,
              backgroundColor: isDark ? "#1e3a8a20" : "#eff6ff",
              borderWidth: 1,
              borderColor: isDark ? "#1e40af40" : "#bfdbfe",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: isDark ? "#60a5fa" : "#1d4ed8",
                marginBottom: 4,
              }}
            >
              💡 Jak to działa
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.textSecondary,
                lineHeight: 18,
              }}
            >
              Najpierw dostajesz nagrania z bazy, których jeszcze nie
              słyszałeś; nowe dogrywamy w tle, gdy baza się kończy.
              Odsłuchujesz je bez limitu, aż zrozumiesz.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
