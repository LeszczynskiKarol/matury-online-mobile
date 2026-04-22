// ============================================================================
// Profile Screen
// ============================================================================

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark, toggle, setMode } = useTheme();
  const { user, isPremium, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Wylogować?', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyloguj', style: 'destructive', onPress: logout },
    ]);
  };

  const statusLabel: Record<string, string> = {
    FREE: 'Darmowe',
    ACTIVE: 'Premium (subskrypcja)',
    ONE_TIME: 'Premium (jednorazowe)',
    PAST_DUE: 'Zaległa płatność',
    CANCELLED: 'Anulowane',
    EXPIRED: 'Wygasło',
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
      <Text
        style={{
          fontSize: 28,
          fontFamily: 'Outfit_700Bold',
          color: theme.text,
          marginBottom: 24,
        }}
      >
        Profil
      </Text>

      {/* Avatar + name */}
      <Card style={{ marginBottom: 20, alignItems: 'center', paddingVertical: 28 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.navy[600],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 28, fontFamily: 'Outfit_700Bold', color: '#fff' }}>
            {(user?.name?.[0] || user?.email?.[0] || 'M').toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontFamily: 'Outfit_700Bold', color: theme.text }}>
          {user?.name || 'Maturzysta'}
        </Text>
        <Text style={{ fontSize: 14, fontFamily: 'DMSans_400Regular', color: theme.textSecondary, marginTop: 2 }}>
          {user?.email}
        </Text>

        {/* Badges */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Badge variant="level" value={user?.globalLevel || 1} />
          <Badge variant="xp" value={`${user?.totalXp || 0} XP`} icon="⚡" />
          <Badge variant="streak" value={`${user?.currentStreak || 0}🔥`} />
        </View>
      </Card>

      {/* Subscription */}
      <Card style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 14, fontFamily: 'DMSans_500Medium', color: theme.textSecondary }}>
              Plan
            </Text>
            <Text style={{ fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: theme.text, marginTop: 2 }}>
              {statusLabel[user?.subscriptionStatus || 'FREE'] || 'Darmowe'}
            </Text>
          </View>
          {!isPremium && (
            <TouchableOpacity
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: radius.xl,
                backgroundColor: colors.brand[500],
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: '#fff' }}>
                Przejdź na Premium
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>

      {/* Settings */}
      <Card style={{ marginBottom: 20, padding: 0 }}>
        {/* Dark mode */}
        <TouchableOpacity
          onPress={toggle}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: theme.borderLight,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={theme.textSecondary} />
            <Text style={{ fontSize: 15, fontFamily: 'DMSans_500Medium', color: theme.text }}>
              Tryb ciemny
            </Text>
          </View>
          <View
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              backgroundColor: isDark ? colors.brand[500] : colors.zinc[300],
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#fff',
                alignSelf: isDark ? 'flex-end' : 'flex-start',
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Stats row */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="flame" size={20} color={colors.orange[500]} />
            <Text style={{ fontSize: 15, fontFamily: 'DMSans_500Medium', color: theme.text }}>
              Najdłuższa seria
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: theme.text }}>
            {user?.longestStreak || 0} dni
          </Text>
        </View>
      </Card>

      {/* Logout */}
      <Button title="Wyloguj się" onPress={handleLogout} variant="ghost" />
    </ScrollView>
  );
}
