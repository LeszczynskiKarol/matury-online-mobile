// ============================================================================
// ListeningHubScreen — wybór języka dla listeningu, deep-link do QuizTab
// ============================================================================

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
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

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

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
    navigation.navigate("QuizTab", {
      screen: "QuizPlay",
      params: {
        sessionId: "__listening__",
        questions: [],
        subjectName: subject.name,
        subjectId: subject.id,
        questionTypes: ["LISTENING"],
      },
    });
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
        Wybierz język — AI wygeneruje świeże nagrania w czasie rzeczywistym.
      </Text>

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
              Każde zadanie ma świeże, unikalne nagranie generowane przez AI.
              Możesz odsłuchać każde zadanie maks. 2 razy — jak na prawdziwej
              maturze.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
