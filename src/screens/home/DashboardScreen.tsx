// ============================================================================
// Dashboard Screen — Home tab
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getDashboard, type DashboardData } from '../../api/sessions';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark, toggle } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const d = await getDashboard();
      setData(d);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const firstName = user?.name?.split(' ')[0] || 'Cześć';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
          Ładowanie...
        </Text>
      </View>
    );
  }

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
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <View>
          <Text style={{ fontSize: 14, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
            Witaj 👋
          </Text>
          <Text style={{ fontSize: 24, fontFamily: 'Outfit_700Bold', color: theme.text }}>
            {firstName}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Badge variant="streak" value={`${data?.user.currentStreak || 0}🔥`} />
          <TouchableOpacity onPress={toggle}>
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={22}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <Card variant="stat" style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontFamily: 'DMSans_500Medium', color: theme.textSecondary }}>XP</Text>
          <Text style={{ fontSize: 22, fontFamily: 'Outfit_700Bold', color: theme.primaryText, marginTop: 2 }}>
            {data?.user.totalXp || 0}
          </Text>
        </Card>
        <Card variant="stat" style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontFamily: 'DMSans_500Medium', color: theme.textSecondary }}>Poziom</Text>
          <Text style={{ fontSize: 22, fontFamily: 'Outfit_700Bold', color: theme.secondaryText, marginTop: 2 }}>
            {data?.user.globalLevel || 1}
          </Text>
        </Card>
        <Card variant="stat" style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontFamily: 'DMSans_500Medium', color: theme.textSecondary }}>Powtórki</Text>
          <Text style={{ fontSize: 22, fontFamily: 'Outfit_700Bold', color: colors.orange[500], marginTop: 2 }}>
            {data?.dueReviews || 0}
          </Text>
        </Card>
      </View>

      {/* Daily goal */}
      {data?.today && (
        <Card style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: theme.text }}>
              Cel dnia
            </Text>
            {data.today.isCompleted && (
              <Badge variant="xp" value="✅ Zrobione!" />
            )}
          </View>

          {/* Questions progress */}
          <View style={{ gap: 12 }}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
                  Pytania
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: theme.text }}>
                  {data.today.questionsCompleted}/{data.today.targetQuestions}
                </Text>
              </View>
              <ProgressBar
                progress={(data.today.questionsCompleted / data.today.targetQuestions) * 100}
                height={6}
              />
            </View>

            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
                  XP
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: theme.text }}>
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

      {/* Subject progress */}
      {data?.subjectProgress && data.subjectProgress.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Outfit_600SemiBold',
              color: theme.text,
              marginBottom: 12,
            }}
          >
            Twoje przedmioty
          </Text>
          <View style={{ gap: 12 }}>
            {data.subjectProgress.map((sp) => (
              <TouchableOpacity
                key={sp.subject.slug}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('SubjectsTab')}
              >
                <Card variant="stat">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.lg,
                        backgroundColor: (sp.subject.color || '#6366f1') + '1A',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{sp.subject.icon || '📚'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: theme.text }}>
                        {sp.subject.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
                        Poz. {sp.level} · {sp.questionsAnswered} pytań · {sp.accuracy}% trafność
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Recent sessions */}
      {data?.recentSessions && data.recentSessions.length > 0 && (
        <View>
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Outfit_600SemiBold',
              color: theme.text,
              marginBottom: 12,
            }}
          >
            Ostatnie sesje
          </Text>
          <View style={{ gap: 8 }}>
            {data.recentSessions.map((s) => (
              <Card key={s.id} variant="stat">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>{s.subject.icon || '📝'}</Text>
                    <View>
                      <Text style={{ fontSize: 14, fontFamily: 'DMSans_500Medium', color: theme.text }}>
                        {s.subject.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
                        {s.questionsAnswered} pytań · {s.accuracy}%
                      </Text>
                    </View>
                  </View>
                  <Badge variant="xp" value={`+${s.xpEarned} XP`} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
