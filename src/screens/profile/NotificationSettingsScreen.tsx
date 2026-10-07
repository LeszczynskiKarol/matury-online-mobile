// ============================================================================
// Ustawienia powiadomień — jeden ekran zamiast rzędu przełączników w Profilu
// (Karol 7.10.2026: „teraz zrobi się tam dużo przełączników”).
//
// Tabela: wiersze = rodzaje powiadomień, kolumny = kanały „Aplikacja” | „E-mail”.
//   Przypomnienia o nauce      → pushReminders | emailReminders
//   Wyniki i odpowiedzi        → pushUpdates   | — (mail transakcyjny)
//   Podsumowanie tygodnia      → —             | emailSummary
//   Promocje i komunikaty      → marketingConsent (jedna zgoda: apka i e-mail)
// Płatności i bezpieczeństwo przychodzą zawsze. Pushe działają tylko, gdy
// telefon na nie pozwala — wtedy ostrzeżenie z „Otwórz ustawienia”.
// ============================================================================

import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { setEmailPrefs, setMarketingConsent } from "../../api/auth";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme";
import { BackBar } from "../../components/common/BackBar";

type PrefKey = "pushReminders" | "emailReminders" | "pushUpdates" | "emailSummary" | "marketingConsent";

interface Row {
  title: string;
  info: string;
  push: PrefKey | null | "same";
  email: PrefKey | null | "same";
}

const ROWS: Row[] = [
  {
    title: "Przypomnienia o nauce",
    info: "Gdy seria jest zagrożona, czeka darmowe podejście albo zbliża się termin od korepetytora. Najwyżej jedno dziennie, nie w nocy.",
    push: "pushReminders",
    email: "emailReminders",
  },
  {
    title: "Wyniki i odpowiedzi na zgłoszenia",
    info: "Wynik oddanego arkusza i nasza odpowiedź, gdy zgłosisz błąd w zadaniu. Mail z odpowiedzią przychodzi tylko wtedy, gdy powiadomienia w aplikacji nie działają.",
    push: "pushUpdates",
    email: null,
  },
  {
    title: "Podsumowanie tygodnia",
    info: "Niedzielny raport z Twojej nauki. Tylko e-mailem.",
    push: null,
    email: "emailSummary",
  },
  {
    title: "Promocje i komunikaty",
    info: "Nowości i oferty. Jedna zgoda obejmuje aplikację i e-mail, możesz ją cofnąć w każdej chwili.",
    push: "marketingConsent",
    email: "same",
  },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const { user, refresh } = useAuth();
  const u = user as any;

  const fromUser = useCallback(
    (): Record<PrefKey, boolean> => ({
      pushReminders: u?.pushReminders !== false,
      emailReminders: u?.emailReminders !== false,
      pushUpdates: u?.pushUpdates !== false,
      emailSummary: u?.emailSummary !== false,
      marketingConsent: u?.marketingConsent === true,
    }),
    [u?.pushReminders, u?.emailReminders, u?.pushUpdates, u?.emailSummary, u?.marketingConsent],
  );
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(fromUser);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [openInfo, setOpenInfo] = useState<number | null>(null);
  const [osDenied, setOsDenied] = useState(false);

  useEffect(() => setPrefs(fromUser()), [fromUser]);

  // Uprawnienie systemowe: sprawdzamy przy wejściu i po powrocie z ustawień.
  useEffect(() => {
    const check = () =>
      Notifications.getPermissionsAsync()
        .then((p) => setOsDenied(p.status !== "granted"))
        .catch(() => {});
    check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => sub.remove();
  }, []);

  const toggle = async (key: PrefKey) => {
    if (saving) return;
    const want = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: want }));
    setSaving(key);
    try {
      if (key === "marketingConsent") await setMarketingConsent(want);
      else await setEmailPrefs({ [key]: want } as any);
      refresh().catch(() => {});
    } catch {
      setPrefs((p) => ({ ...p, [key]: !want }));
    } finally {
      setSaving(null);
    }
  };

  const Switch = ({ k }: { k: PrefKey }) => {
    const on = prefs[k];
    return (
      <TouchableOpacity
        onPress={() => toggle(k)}
        disabled={saving !== null}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        hitSlop={8}
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          backgroundColor: on ? colors.brand[500] : colors.zinc[300],
          justifyContent: "center",
          paddingHorizontal: 3,
          opacity: saving === k ? 0.6 : 1,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: "#fff",
            alignSelf: on ? "flex-end" : "flex-start",
          }}
        />
      </TouchableOpacity>
    );
  };

  const Cell = ({ v }: { v: PrefKey | null | "same" }) => (
    <View style={{ width: 72, alignItems: "center" }}>
      {v === null ? (
        <Text style={{ color: theme.textTertiary, fontSize: 15 }}>—</Text>
      ) : v === "same" ? (
        <Text style={{ color: theme.textTertiary, fontSize: 11, textAlign: "center" }}>ta sama zgoda</Text>
      ) : (
        <Switch k={v} />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[2], paddingBottom: 40 }}>
        <BackBar label="Profil" />
        <Text style={{ fontSize: 24, fontWeight: "800", color: theme.text, paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
          Powiadomienia
        </Text>

        {osDenied && (
          <View
            style={{
              marginHorizontal: spacing[5],
              marginBottom: spacing[4],
              padding: spacing[4],
              borderRadius: 14,
              backgroundColor: colors.orange[500] + "1A",
              borderWidth: 1,
              borderColor: colors.orange[500] + "55",
            }}
          >
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>
              Powiadomienia są wyłączone w ustawieniach telefonu
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
              Bez tego nie dostaniesz nic w aplikacji, nawet gdy przełączniki są włączone.
            </Text>
            <TouchableOpacity onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.brand[500], fontSize: 14, fontWeight: "700" }}>Otwórz ustawienia ›</Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={{
            marginHorizontal: spacing[5],
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.borderLight,
            backgroundColor: theme.card,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
            }}
          >
            <Text style={{ flex: 1 }} />
            <Text style={{ width: 72, textAlign: "center", fontSize: 12, fontWeight: "700", color: theme.textSecondary }}>Aplikacja</Text>
            <Text style={{ width: 72, textAlign: "center", fontSize: 12, fontWeight: "700", color: theme.textSecondary }}>E-mail</Text>
          </View>
          {ROWS.map((r, i) => (
            <View
              key={r.title}
              style={{
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                borderBottomWidth: i < ROWS.length - 1 ? 1 : 0,
                borderBottomColor: theme.borderLight,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => setOpenInfo(openInfo === i ? null : i)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 6 }}
                  accessibilityHint="Pokaż wyjaśnienie"
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text, flexShrink: 1 }}>{r.title}</Text>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 1,
                      borderColor: theme.textTertiary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textTertiary }}>i</Text>
                  </View>
                </TouchableOpacity>
                <Cell v={r.push} />
                <Cell v={r.email} />
              </View>
              {openInfo === i && (
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 6, lineHeight: 17 }}>{r.info}</Text>
              )}
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 12, color: theme.textTertiary, paddingHorizontal: spacing[5], marginTop: spacing[3], lineHeight: 17 }}>
          Sprawy płatności i bezpieczeństwa konta przychodzą zawsze. Powiadomienia w dzwonku na pulpicie zostają niezależnie od tych ustawień.
        </Text>
      </ScrollView>
    </View>
  );
}
