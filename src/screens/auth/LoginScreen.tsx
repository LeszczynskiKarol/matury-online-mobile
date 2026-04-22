// ============================================================================
// Login Screen
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList>;

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark, toggle } = useTheme();
  const navigation = useNavigation<Nav>();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleLogin = async () => {
    setErrors({});
    if (!email.trim()) return setErrors({ email: 'Podaj email' });
    if (!password) return setErrors({ password: 'Podaj hasło' });

    setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result.requiresVerification) {
        navigation.navigate('Verify', { email: result.email! });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('Błąd', err.message);
      } else {
        Alert.alert('Błąd', 'Nie udało się połączyć z serwerem');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: spacing[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Dark mode toggle */}
        <TouchableOpacity
          onPress={toggle}
          style={{ alignSelf: 'flex-end', padding: 8 }}
        >
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={22}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {/* Logo */}
        <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 48 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.xl,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.navy[600],
              marginBottom: 16,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 24, fontFamily: 'Outfit_700Bold' }}>
              M
            </Text>
          </View>
          <Text
            style={{
              fontSize: 28,
              fontFamily: 'Outfit_700Bold',
              color: theme.text,
            }}
          >
            Matury Online
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'DMSans_400Regular',
              color: theme.textSecondary,
              marginTop: 4,
            }}
          >
            Zaloguj się na swoje konto
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 16 }}>
          <Input
            label="Email"
            icon="mail-outline"
            placeholder="twoj@email.pl"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />
          <Input
            label="Hasło"
            icon="lock-closed-outline"
            placeholder="Twoje hasło"
            value={password}
            onChangeText={setPassword}
            isPassword
            error={errors.password}
          />

          <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: -4 }}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'DMSans_500Medium',
                color: colors.brand[500],
              }}
            >
              Zapomniałem hasła
            </Text>
          </TouchableOpacity>

          <Button
            title="Zaloguj się"
            onPress={handleLogin}
            loading={loading}
            style={{ marginTop: 8 }}
          />

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginVertical: 8,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'DMSans_400Regular',
                color: theme.textTertiary,
              }}
            >
              lub
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>

          {/* Google button */}
          <Button
            title="Kontynuuj z Google"
            onPress={() => Alert.alert('Google OAuth', 'Google Sign-In wymaga konfiguracji Expo AuthSession')}
            variant="outline"
            icon={
              <Ionicons name="logo-google" size={18} color={theme.text} />
            }
          />
        </View>

        {/* Register link */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 32,
            gap: 4,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'DMSans_400Regular',
              color: theme.textSecondary,
            }}
          >
            Nie masz konta?
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'DMSans_600SemiBold',
                color: colors.brand[500],
              }}
            >
              Zarejestruj się
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
