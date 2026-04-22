// ============================================================================
// Verify Email Screen — 6-digit code
// ============================================================================

import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';

export function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { verifyEmail } = useAuth();

  const email = route.params?.email || '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newCode.every((c) => c.length === 1)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeStr = fullCode || code.join('');
    if (codeStr.length < 6) return;

    setLoading(true);
    try {
      await verifyEmail(email, codeStr);
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('Błąd', err.message);
      } else {
        Alert.alert('Błąd', 'Nie udało się zweryfikować kodu');
      }
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendCode(email);
      Alert.alert('Wysłano', 'Nowy kod został wysłany na Twój email');
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się wysłać kodu');
    } finally {
      setResending(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: insets.top + 20,
        paddingHorizontal: spacing[6],
      }}
    >
      {/* Back */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 40 }}
      >
        <Ionicons name="chevron-back" size={22} color={theme.text} />
        <Text style={{ fontSize: 15, fontFamily: 'DMSans_500Medium', color: theme.text }}>
          Wróć
        </Text>
      </TouchableOpacity>

      {/* Icon */}
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.brand[500] + '1A',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ionicons name="mail-outline" size={28} color={colors.brand[500]} />
        </View>
        <Text
          style={{
            fontSize: 24,
            fontFamily: 'Outfit_700Bold',
            color: theme.text,
            textAlign: 'center',
          }}
        >
          Potwierdź email
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'DMSans_400Regular',
            color: theme.textSecondary,
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Wysłaliśmy 6-cyfrowy kod na{'\n'}
          <Text style={{ fontFamily: 'DMSans_600SemiBold', color: theme.text }}>
            {email}
          </Text>
        </Text>
      </View>

      {/* Code inputs */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 32,
        }}
      >
        {code.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => { inputs.current[i] = ref; }}
            value={digit}
            onChangeText={(t) => handleChange(t.replace(/[^0-9]/g, ''), i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            style={{
              width: 48,
              height: 56,
              borderRadius: radius.xl,
              borderWidth: 2,
              borderColor: digit ? colors.brand[500] : theme.border,
              backgroundColor: theme.inputBg,
              textAlign: 'center',
              fontSize: 22,
              fontFamily: 'JetBrainsMono_600SemiBold',
              color: theme.text,
            }}
          />
        ))}
      </View>

      <Button
        title="Weryfikuj"
        onPress={() => handleVerify()}
        loading={loading}
        disabled={code.some((c) => !c)}
      />

      {/* Resend */}
      <TouchableOpacity
        onPress={handleResend}
        disabled={resending}
        style={{ alignItems: 'center', marginTop: 24 }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'DMSans_500Medium',
            color: resending ? theme.textTertiary : colors.brand[500],
          }}
        >
          {resending ? 'Wysyłanie...' : 'Wyślij ponownie'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
