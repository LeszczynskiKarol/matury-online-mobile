// Kafel przedmiotu na pulpicie — lustro webowego SubjectProgressCard
// (frontend/src/components/dashboard/DashboardHome.tsx, Karol 26.09.2026):
// ✕ usuwa z panelu (wraca przez „＋ Dodaj przedmiot”), licznik wszystkich
// zadań (Quiz + arkusze), celność tylko z Quizu, pasek „X / Y XP do poziomu N”
// i szybkie tryby: Quiz, Egzamin, Słuchanie (języki).
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

interface SP {
  subject: { slug: string; name: string; icon: string | null; color: string | null };
  level: number;
  xp: number;
  questionsAnswered: number;
  accuracy: number;
  levelProgress?: { current: number; next: number; progress: number; maxed: boolean };
  quiz?: { answered: number; accuracy: number | null };
}

function zadan(n: number) {
  if (n === 1) return "zadanie";
  const n10 = n % 10, n100 = n % 100;
  return n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? "zadania" : "zadań";
}

export function SubjectTile({
  sp,
  canRemove,
  onRemove,
  onQuiz,
  onExam,
  onListening,
}: {
  sp: SP;
  canRemove: boolean;
  onRemove: () => void;
  onQuiz: () => void;
  onExam: () => void;
  onListening?: () => void;
}) {
  const { colors: theme } = useTheme();
  const color = sp.subject.color || "#6366f1";
  const quizAnswered = sp.quiz?.answered ?? 0;
  const answered = Math.max(sp.questionsAnswered ?? 0, quizAnswered);
  const accuracy = sp.quiz ? (quizAnswered > 0 ? sp.quiz.accuracy : null) : Math.round(sp.accuracy);
  const lp = sp.levelProgress;

  const modes: { key: string; icon: any; label: string; onPress: () => void }[] = [
    { key: "quiz", icon: "flash-outline", label: "Quiz", onPress: onQuiz },
    { key: "exam", icon: "document-text-outline", label: "Egzamin", onPress: onExam },
  ];
  if (onListening) modes.push({ key: "listen", icon: "headset-outline", label: "Słuchanie", onPress: onListening });

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onQuiz} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingRight: canRemove ? 26 : 0 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: color + "1A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 20 }}>{sp.subject.icon || "📚"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }} numberOfLines={1}>
            {sp.subject.name}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            {answered > 0 ? `${answered} ${zadan(answered)}` : "Jeszcze bez ćwiczeń"}
            {accuracy != null ? ` · celność w Quizie ${accuracy}%` : ""}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: color + "22" }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color }}>Poziom {sp.level}</Text>
        </View>
      </TouchableOpacity>

      {canRemove && (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={10}
          accessibilityLabel={`Usuń ${sp.subject.name} z panelu`}
          style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      )}

      {lp && !lp.maxed && sp.xp > 0 && (
        <View style={{ marginTop: 12 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(lp.progress * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.brand[500] }} />
          </View>
          <Text style={{ fontSize: 10, color: theme.textTertiary, marginTop: 4 }}>
            {sp.xp} / {lp.next} XP do poziomu {sp.level + 1}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {modes.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={m.onPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 10,
              backgroundColor: theme.border + "66",
            }}
          >
            <Ionicons name={m.icon} size={14} color={theme.text} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
