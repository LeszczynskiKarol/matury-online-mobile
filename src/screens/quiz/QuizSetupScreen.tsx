// ============================================================================
// Quiz Setup Screen — configure and start a session
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { subjectsApi } from '../../api';
import { createSession, type SessionType } from '../../api/sessions';
import type { Subject } from '../../api/subjects';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';
import type { QuizStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<QuizStackParamList>;

const SESSION_TYPES: { value: SessionType; label: string; icon: string; desc: string }[] = [
  { value: 'PRACTICE', label: 'Praktyka', icon: '🎯', desc: 'Ćwicz we własnym tempie' },
  { value: 'ADAPTIVE', label: 'Adaptacyjny', icon: '🧠', desc: 'AI dobiera trudność' },
  { value: 'MOCK_EXAM', label: 'Egzamin', icon: '📝', desc: 'Symulacja matury' },
];

const QUESTION_COUNTS = [5, 10, 15, 20, 30];

export function QuizSetupScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>(route.params?.subjectId || '');
  const [selectedType, setSelectedType] = useState<SessionType>('PRACTICE');
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await subjectsApi.getSubjects();
      setSubjects(data.filter((s) => s.isActive));
      if (!selectedSubject && data.length > 0) {
        setSelectedSubject(data[0].id);
      }
    })();
  }, []);

  const selectedSubjectData = subjects.find((s) => s.id === selectedSubject);

  const handleStart = async () => {
    if (!selectedSubject) {
      return Alert.alert('Wybierz przedmiot');
    }
    setLoading(true);
    try {
      const session = await createSession({
        subjectId: selectedSubject,
        type: selectedType,
        topicId: route.params?.topicId,
        questionCount,
      });

      if (session.error) {
        Alert.alert('Błąd', session.error);
        return;
      }

      navigation.navigate('QuizPlay', {
        sessionId: session.sessionId,
        questions: session.questions,
        subjectName: selectedSubjectData?.name || 'Quiz',
      });
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się utworzyć sesji');
    } finally {
      setLoading(false);
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
      <Text style={{ fontSize: 28, fontFamily: 'Outfit_700Bold', color: theme.text, marginBottom: 24 }}>
        Nowy quiz
      </Text>

      {/* Subject picker */}
      <Text style={{ fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: theme.text, marginBottom: 12 }}>
        Przedmiot
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSelectedSubject(s.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: radius.xl,
                borderWidth: 2,
                borderColor: s.id === selectedSubject ? colors.brand[500] : theme.border,
                backgroundColor: s.id === selectedSubject ? colors.brand[500] + '1A' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Outfit_500Medium',
                  color: s.id === selectedSubject ? colors.brand[600] : theme.textSecondary,
                }}
              >
                {s.icon} {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Session type */}
      <Text style={{ fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: theme.text, marginBottom: 12 }}>
        Tryb
      </Text>
      <View style={{ gap: 8, marginBottom: 24 }}>
        {SESSION_TYPES.map((st) => (
          <TouchableOpacity
            key={st.value}
            onPress={() => setSelectedType(st.value)}
            activeOpacity={0.85}
          >
            <Card
              variant="stat"
              style={{
                borderWidth: 2,
                borderColor: st.value === selectedType ? colors.brand[500] : theme.cardBorder,
                backgroundColor: st.value === selectedType ? colors.brand[500] + '0D' : theme.card,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24 }}>{st.icon}</Text>
                <View>
                  <Text style={{ fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: theme.text }}>
                    {st.label}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
                    {st.desc}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      {/* Question count */}
      <Text style={{ fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: theme.text, marginBottom: 12 }}>
        Liczba pytań
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
        {QUESTION_COUNTS.map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setQuestionCount(n)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radius.xl,
              borderWidth: 2,
              borderColor: n === questionCount ? colors.brand[500] : theme.border,
              backgroundColor: n === questionCount ? colors.brand[500] + '1A' : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Outfit_600SemiBold',
                color: n === questionCount ? colors.brand[600] : theme.textSecondary,
              }}
            >
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title="Rozpocznij"
        onPress={handleStart}
        loading={loading}
        icon={<Ionicons name="play" size={18} color="#fff" />}
        size="lg"
      />
    </ScrollView>
  );
}
