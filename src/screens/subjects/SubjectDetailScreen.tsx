import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { subjectsApi } from "../../api";
import type { Topic } from "../../api/subjects";
import { createSession } from "../../api/sessions";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";

export function SubjectDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { slug, name } = route.params;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await subjectsApi.getSubject(slug);
        setTopics(data.topics?.filter((t) => t.questionCount > 0) || []);
        setSubjectId(data.id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const startQuizDirect = async (topicId?: string) => {
    if (!subjectId) return;
    setStartingTopicId(topicId || "__all__");
    try {
      const session = await createSession({
        subjectId,
        type: "PRACTICE",
        topicId,
        questionCount: 10,
      });
      if (session.error) {
        Alert.alert("Błąd", session.error);
        return;
      }
      navigation.navigate("QuizTab", {
        screen: "QuizPlay",
        params: {
          sessionId: session.sessionId,
          questions: session.questions,
          subjectName: name,
          subjectId,
          questionTypes: undefined,
        },
      });
    } catch (err: any) {
      Alert.alert("Błąd", err.message || "Nie udało się utworzyć sesji");
    } finally {
      setStartingTopicId(null);
    }
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
      {/* Back + title */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          marginBottom: 16,
        }}
      >
        <Ionicons name="chevron-back" size={22} color={theme.text} />
        <Text
          style={{
            fontSize: 15,
            fontFamily: "DMSans_500Medium",
            color: theme.text,
          }}
        >
          Przedmioty
        </Text>
      </TouchableOpacity>

      <Text
        style={{
          fontSize: 28,
          fontFamily: "Outfit_700Bold",
          color: theme.text,
          marginBottom: 8,
        }}
      >
        {name}
      </Text>

      {/* Quick start — all topics */}
      <Button
        title={
          startingTopicId === "__all__"
            ? "Tworzę sesję..."
            : "Rozpocznij quiz — wszystkie tematy"
        }
        onPress={() => startQuizDirect()}
        loading={startingTopicId === "__all__"}
        icon={<Ionicons name="play" size={18} color="#fff" />}
        style={{ marginBottom: 24 }}
      />

      {/* Topics */}
      <Text
        style={{
          fontSize: 18,
          fontFamily: "Outfit_600SemiBold",
          color: theme.text,
          marginBottom: 12,
        }}
      >
        Tematy
      </Text>

      {loading ? (
        <Text
          style={{
            color: theme.textSecondary,
            textAlign: "center",
            marginTop: 20,
          }}
        >
          Ładowanie...
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {topics.map((topic) => {
            const isStarting = startingTopicId === topic.id;
            return (
              <TouchableOpacity
                key={topic.id}
                activeOpacity={0.85}
                disabled={!!startingTopicId}
                onPress={() => startQuizDirect(topic.id)}
              >
                <Card variant="stat">
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontFamily: "DMSans_500Medium",
                          color: theme.text,
                        }}
                      >
                        {topic.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "DMSans_400Regular",
                          color: theme.textSecondary,
                        }}
                      >
                        {topic.questionCount} pytań
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.brand[500] + "1A",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isStarting ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.brand[500]}
                        />
                      ) : (
                        <Ionicons
                          name="play"
                          size={16}
                          color={colors.brand[500]}
                        />
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
