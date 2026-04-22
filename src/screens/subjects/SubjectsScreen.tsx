// ============================================================================
// Subjects List Screen
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { subjectsApi } from '../../api';
import type { Subject } from '../../api/subjects';
import { SubjectCard } from '../../components/common/SubjectCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme';
import type { SubjectsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<SubjectsStackParamList>;

export function SubjectsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSubjects = async () => {
    try {
      const data = await subjectsApi.getSubjects();
      setSubjects(data.filter((s) => s.isActive));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSubjects();
    setRefreshing(false);
  };

  // Match user progress to subjects
  const getProgress = (subjectId: string) => {
    const sp = user?.subjectProgress?.find((p) => p.subjectId === subjectId);
    return {
      questionsAnswered: sp?.questionsAnswered || 0,
      accuracy: sp && sp.questionsAnswered > 0
        ? Math.round((sp.correctAnswers / sp.questionsAnswered) * 100)
        : 0,
      level: sp?.level || 1,
    };
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />}
    >
      <Text
        style={{
          fontSize: 28,
          fontFamily: 'Outfit_700Bold',
          color: theme.text,
          marginBottom: 8,
        }}
      >
        Przedmioty
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontFamily: 'DMSans_400Regular',
          color: theme.textSecondary,
          marginBottom: 24,
        }}
      >
        Wybierz przedmiot do nauki
      </Text>

      {loading ? (
        <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>
          Ładowanie przedmiotów...
        </Text>
      ) : (
        <View style={{ gap: 12 }}>
          {subjects.map((s) => {
            const progress = getProgress(s.id);
            return (
              <SubjectCard
                key={s.id}
                name={s.name}
                icon={s.icon}
                color={s.color}
                questionsAnswered={progress.questionsAnswered}
                accuracy={progress.accuracy}
                level={progress.level}
                onPress={() => navigation.navigate('SubjectDetail', { slug: s.slug, name: s.name })}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
