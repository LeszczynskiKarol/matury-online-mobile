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
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { forgotPassword } from "../../api/auth";
import { ApiError } from "../../api/client";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import type { AuthStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList>;

export function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()) return setError("Podaj adres email");

    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Nie udało się połączyć z serwerem");
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
        {/* Back */}
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
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.xl,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.navy[600],
              marginBottom: 16,
            }}
          >
            <Ionicons name="mail-outline" size={28} color="#fff" />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontFamily: "Outfit_700Bold",
              color: theme.text,
              marginBottom: 8,
            }}
          >
            Resetowanie hasła
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "DMSans_400Regular",
              color: theme.textSecondary,
              textAlign: "center",
            }}
          >
            Podaj email, a wyślemy link do resetu hasła
          </Text>
        </View>

        {sent ? (
          /* Success state */
          <View
            style={{
              backgroundColor: colors.brand[50],
              borderRadius: radius.lg,
              padding: 20,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: "DMSans_500Medium",
                color: colors.brand[700],
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              Jeśli konto z tym emailem istnieje, wysłaliśmy link do resetu
              hasła. Sprawdź skrzynkę (również spam).
            </Text>
            <Button
              title="Wróć do logowania"
              onPress={() => navigation.navigate("Login")}
              style={{ marginTop: 20 }}
            />
          </View>
        ) : (
          /* Form */
          <View style={{ gap: 16 }}>
            <Input
              label="Email"
              icon="mail-outline"
              placeholder="twoj@email.pl"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={error}
            />

            <Button
              title="Wyślij link"
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: 8 }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
