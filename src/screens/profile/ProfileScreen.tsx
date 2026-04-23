// ============================================================================
// Profile Screen — with Subscription link
// ============================================================================

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';
import type { ProfileStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark, toggle } = useTheme();
  const { user, isPremium, logout } = useAuth();
  const navigation = useNavigation<Nav>();

  const handleLogout = () => {
    Alert.alert('Wylogować?', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyloguj', style: 'destructive', onPress: logout },
    ]);
  };

  const statusLabel: Record<string, string> = {
    FREE: 'Darmowe', ACTIVE: 'Premium', ONE_TIME: 'Premium (30 dni)',
    PAST_DUE: 'Zaległa płatność', CANCELLED: 'Anulowane', EXPIRED: 'Wygasło',
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: spacing[5] }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.text, marginBottom: 24 }}>Profil</Text>

      {/* Avatar + name */}
      <Card style={{ marginBottom: 20, alignItems: 'center', paddingVertical: 28 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.navy[600], alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>
            {(user?.name?.[0] || user?.email?.[0] || 'M').toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text }}>{user?.name || 'Maturzysta'}</Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 2 }}>{user?.email}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Badge variant="level" value={user?.globalLevel || 1} />
          <Badge variant="xp" value={`${user?.totalXp || 0} XP`} icon="⚡" />
          <Badge variant="streak" value={`${user?.currentStreak || 0}🔥`} />
        </View>
      </Card>

      {/* Subscription card */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Subscription')}>
        <Card style={{ marginBottom: 20, borderWidth: isPremium ? 0 : 2, borderColor: isPremium ? theme.cardBorder : colors.brand[500] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 40, height: 40, borderRadius: radius.lg,
                backgroundColor: isPremium ? colors.brand[500] + '1A' : colors.red[50],
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons
                  name={isPremium ? 'diamond' : 'lock-closed'}
                  size={20}
                  color={isPremium ? colors.brand[500] : colors.red[500]}
                />
              </View>
              <View>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Plan</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, marginTop: 1 }}>
                  {statusLabel[user?.subscriptionStatus || 'FREE'] || 'Darmowe'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {!isPremium && (
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand[500] }}>Przejdź na Premium</Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </View>
        </Card>
      </TouchableOpacity>

      {/* Settings */}
      <Card style={{ marginBottom: 20, padding: 0 }}>
        <TouchableOpacity
          onPress={toggle}
          style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: spacing[5], paddingVertical: spacing[4],
            borderBottomWidth: 1, borderBottomColor: theme.borderLight,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={theme.textSecondary} />
            <Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Tryb ciemny</Text>
          </View>
          <View style={{
            width: 48, height: 28, borderRadius: 14,
            backgroundColor: isDark ? colors.brand[500] : colors.zinc[300],
            justifyContent: 'center', paddingHorizontal: 3,
          }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isDark ? 'flex-end' : 'flex-start' }} />
          </View>
        </TouchableOpacity>

        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: spacing[5], paddingVertical: spacing[4],
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="flame" size={20} color={colors.orange[500]} />
            <Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Najdłuższa seria</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{user?.longestStreak || 0} dni</Text>
        </View>
      </Card>

      <Button title="Wyloguj się" onPress={handleLogout} variant="ghost" />
    </ScrollView>
  );
}
