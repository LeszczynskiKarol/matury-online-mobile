// ============================================================================
// Register Screen
// ============================================================================

import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ApiError } from "../../api/client";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import type { AuthStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList>;

export function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRegister = async () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Podaj email";
    if (password.length < 8) errs.password = "Min. 8 znaków";
    if (password !== passwordConfirm) errs.passwordConfirm = "Hasła nie pasują";
    if (!acceptTerms) errs.terms = "Musisz zaakceptować regulamin";
    if (Object.keys(errs).length > 0) return setErrors(errs);

    setLoading(true);
    setErrors({});
    try {
      const result = await register({
        email: email.trim().toLowerCase(),
        password,
        passwordConfirm,
        name: name.trim() || undefined,
        acceptTerms,
      });
      if (result.requiresVerification) {
        navigation.navigate("Verify", { email: result.email });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert("Błąd", err.message);
      } else {
        Alert.alert("Błąd", "Nie udało się połączyć z serwerem");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginBottom: 24,
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
            Wróć
          </Text>
        </TouchableOpacity>

        {/* Header */}
        <Text
          style={{
            fontSize: 28,
            fontFamily: "Outfit_700Bold",
            color: theme.text,
            marginBottom: 8,
          }}
        >
          Utwórz konto
        </Text>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "DMSans_400Regular",
            color: theme.textSecondary,
            marginBottom: 32,
          }}
        >
          Dołącz do tysięcy maturzystów
        </Text>

        {/* Form */}
        <View style={{ gap: 16 }}>
          <Input
            label="Imię (opcjonalnie)"
            icon="person-outline"
            placeholder="Jan"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Input
            label="Email"
            icon="mail-outline"
            placeholder="twoj@email.pl"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label="Hasło"
            icon="lock-closed-outline"
            placeholder="Min. 8 znaków"
            value={password}
            onChangeText={setPassword}
            isPassword
            error={errors.password}
          />
          <Input
            label="Powtórz hasło"
            icon="lock-closed-outline"
            placeholder="Powtórz hasło"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            isPassword
            error={errors.passwordConfirm}
          />

          {/* Terms checkbox */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              marginTop: 4,
            }}
          >
            {/* Checkbox — osobny touchable */}
            <TouchableOpacity
              onPress={() => setAcceptTerms(!acceptTerms)}
              style={{ paddingTop: 2 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: errors.terms
                    ? colors.red[500]
                    : acceptTerms
                      ? colors.brand[500]
                      : theme.border,
                  backgroundColor: acceptTerms
                    ? colors.brand[500]
                    : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {acceptTerms && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>

            {/* Tekst z linkami — osobny element */}
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: "DMSans_400Regular",
                color: theme.textSecondary,
              }}
              onPress={() => setAcceptTerms(!acceptTerms)}
            >
              Akceptuję{" "}
              <Text
                style={{
                  color: colors.brand[500],
                  textDecorationLine: "underline",
                }}
                onPress={() =>
                  WebBrowser.openBrowserAsync(
                    "https://www.matury-online.pl/regulamin",
                  )
                }
                suppressHighlighting
              >
                regulamin
              </Text>{" "}
              i{" "}
              <Text
                style={{
                  color: colors.brand[500],
                  textDecorationLine: "underline",
                }}
                onPress={() =>
                  WebBrowser.openBrowserAsync(
                    "https://www.matury-online.pl/polityka-prywatnosci",
                  )
                }
                suppressHighlighting
              >
                politykę prywatności
              </Text>
            </Text>
          </View>

          {errors.terms && (
            <Text
              style={{
                fontSize: 12,
                color: colors.red[500],
                marginLeft: 32,
                marginTop: -8,
              }}
            >
              {errors.terms}
            </Text>
          )}

          <Button
            title="Zarejestruj się"
            onPress={handleRegister}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Login link */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 32,
            gap: 4,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontFamily: "DMSans_400Regular",
              color: theme.textSecondary,
            }}
          >
            Masz już konto?
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "DMSans_600SemiBold",
                color: colors.brand[500],
              }}
            >
              Zaloguj się
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
