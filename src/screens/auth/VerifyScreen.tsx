// ============================================================================
// Verify Email Screen — 6-digit code
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { ApiError } from '../../api/client';
import type { VerificationDeliveryState } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

// Komunikaty jak na webie (/auth/verify). `done` kończy odpytywanie,
// `openChange` od razu rozwija formularz zmiany adresu.
const TONES = {
  ok: { bg: '#16a34a1A', fg: '#15803d' },
  warn: { bg: '#f59e0b1F', fg: '#b45309' },
  err: { bg: '#ef44441A', fg: '#dc2626' },
} as const;

const STATES: Partial<
  Record<
    VerificationDeliveryState,
    { tone: keyof typeof TONES; title?: string; text: string; done?: boolean; openChange?: boolean }
  >
> = {
  delivered: {
    tone: 'ok',
    done: true,
    text: 'Mail z kodem dotarł do Twojej skrzynki. Nie widzisz go? Zajrzyj do folderów Spam i Oferty.',
  },
  mailbox_full: {
    tone: 'warn',
    title: 'Twoja skrzynka pocztowa jest pełna',
    text: 'Serwer poczty odrzuca nowe wiadomości, więc kod nie może dojść. Usuń kilka maili, opróżnij kosz i stuknij „Wyślij ponownie”. Możesz też wejść przez Google albo podać inny adres (niżej).',
  },
  mailbox_full_before: {
    tone: 'warn',
    title: 'Poprzedni kod nie doszedł — skrzynka była pełna',
    text: 'Jeśli zrobiłeś już miejsce, ten kod powinien dotrzeć. Jeśli nie — usuń kilka maili i stuknij „Wyślij ponownie”, wejdź przez Google albo podaj inny adres (niżej).',
  },
  delayed: {
    tone: 'warn',
    text: 'Serwer Twojej poczty chwilowo nie przyjmuje wiadomości, więc kod może przyjść z opóźnieniem. Jeśli nie dotrze w ciągu kilku minut, wejdź przez Google albo podaj inny adres (niżej).',
  },
  undeliverable: {
    tone: 'err',
    done: true,
    openChange: true,
    title: 'Ten adres nie przyjmuje poczty',
    text: 'Serwer odpowiada, że taka skrzynka nie istnieje. Sprawdź pisownię i podaj poprawny adres poniżej.',
  },
  failed: {
    tone: 'err',
    done: true,
    text: 'Nie udało się doręczyć kodu. Stuknij „Wyślij ponownie”, wejdź przez Google albo podaj inny adres (niżej).',
  },
};

// SES zgłasza opóźnienie dopiero przy ponowieniu (u Gmaila ~1 h po wysyłce),
// więc odpytujemy 2 h: co 6 s przez pierwsze 5 min, potem co 30 s.
const WATCH_MS = 2 * 60 * 60_000;
const FAST_MS = 5 * 60_000;

export function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { verifyEmail, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState<string>(route.params?.email || '');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [delivery, setDelivery] = useState<VerificationDeliveryState>('pending');
  // Zmiana `watchKey` restartuje odpytywanie (nowy kod = nowy wiersz EmailLog).
  const [watchKey, setWatchKey] = useState(0);
  const [showChange, setShowChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | undefined>();
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    setDelivery('pending');

    const poll = async () => {
      let state: VerificationDeliveryState = 'pending';
      try {
        state = (await authApi.verificationStatus(email)).state;
      } catch {}
      if (cancelled) return;
      setDelivery(state);
      if (STATES[state]?.openChange) setShowChange(true);
      if (state === 'unknown' || STATES[state]?.done) return;
      const elapsed = Date.now() - started;
      if (elapsed > WATCH_MS) return;
      timer = setTimeout(poll, elapsed < FAST_MS ? 6000 : 30_000);
    };
    timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email, watchKey]);

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
      setWatchKey((k) => k + 1);
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się wysłać kodu');
    } finally {
      setResending(false);
    }
  };

  // Konto Google omija maila całkowicie. Ten sam adres co przy rejestracji:
  // backend podpina Google do istniejącego konta i oznacza je jako zweryfikowane.
  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') return; // anulowane przez użytkownika
      const idToken = response.data.idToken;
      if (!idToken) {
        Alert.alert('Błąd', 'Google nie zwróciło tokenu logowania');
        return;
      }
      await loginWithGoogle(idToken);
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('Błąd', err.message);
      } else if (isErrorWithCode(err) && err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Błąd', 'Google Play Services niedostępne na tym urządzeniu');
      } else {
        Alert.alert('Błąd', 'Logowanie przez Google nie powiodło się');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleChangeEmail = useCallback(async () => {
    setChangeError(undefined);
    const next = newEmail.trim().toLowerCase();
    if (!next) return setChangeError('Podaj nowy adres');
    if (!password) return setChangeError('Podaj hasło z rejestracji');

    setChanging(true);
    try {
      const res = await authApi.changeUnverifiedEmail({ email, password, newEmail: next });
      setEmail(res.email);
      setShowChange(false);
      setNewEmail('');
      setPassword('');
      setCode(['', '', '', '', '', '']);
      setWatchKey((k) => k + 1);
      Alert.alert('Wysłano', `Nowy kod wysłaliśmy na ${res.email}`);
    } catch (err: any) {
      setChangeError(err?.message || 'Nie udało się zmienić adresu');
    } finally {
      setChanging(false);
    }
  }, [email, newEmail, password]);

  const status = STATES[delivery];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: spacing[6],
        }}
        keyboardShouldPersistTaps="handled"
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

        {/* Stan doręczenia (pełna skrzynka, nieistniejący adres, doręczono) */}
        {status && (
          <View
            style={{
              backgroundColor: TONES[status.tone].bg,
              borderRadius: radius.xl,
              padding: 14,
              marginBottom: 24,
            }}
          >
            {status.title && (
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'DMSans_600SemiBold',
                  color: TONES[status.tone].fg,
                  marginBottom: 4,
                }}
              >
                {status.title}
              </Text>
            )}
            <Text
              style={{
                fontSize: 13,
                lineHeight: 19,
                fontFamily: 'DMSans_400Regular',
                color: TONES[status.tone].fg,
              }}
            >
              {status.text}
            </Text>
          </View>
        )}

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

        {/* Wyjścia awaryjne: kod nie dochodzi (pełna skrzynka, literówka w adresie) */}
        <View
          style={{
            marginTop: 28,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            gap: 16,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'DMSans_400Regular',
              color: theme.textSecondary,
              textAlign: 'center',
            }}
          >
            Kod nie dociera? Masz jeszcze dwa wyjścia:
          </Text>

          <Button
            title="Kontynuuj z Google"
            onPress={handleGoogle}
            variant="outline"
            loading={googleLoading}
            icon={<Ionicons name="logo-google" size={18} color={theme.text} />}
          />

          <TouchableOpacity
            onPress={() => setShowChange((v) => !v)}
            style={{ alignItems: 'center' }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'DMSans_600SemiBold',
                color: colors.brand[500],
              }}
            >
              Zmień adres e-mail
            </Text>
          </TouchableOpacity>

          {showChange && (
            <View style={{ gap: 14 }}>
              <Input
                label="Nowy adres e-mail"
                icon="mail-outline"
                placeholder="twoj@email.pl"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Input
                label="Hasło podane przy rejestracji"
                icon="lock-closed-outline"
                placeholder="Twoje hasło"
                value={password}
                onChangeText={setPassword}
                isPassword
                error={changeError}
              />
              <Button
                title="Wyślij kod na nowy adres"
                onPress={handleChangeEmail}
                loading={changing}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
