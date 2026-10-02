// ============================================================================
// UpdatePrompt — „Jest nowa wersja” we własnym stylu apki
// Przy starcie i po powrocie na pierwszy plan pyta backend o najnowszą wersję;
// jeśli zainstalowana jest starsza, pokazuje okno w stylu apki (zamiast
// systemowego Alertu Androida — Karol 2.10.2026). Po „Później” wraca dopiero
// po REMIND_AFTER_MS. Nigdy nie blokuje apki.
//
// Analityka (POST /usage/track → feature_click, panel admina → Użycie):
//   props.feature = "update_prompt", props.action = shown | update | later,
//   props.version = wersja w sklepie, props.from = zainstalowana wersja.
// Z tego da się policzyć, ile osób widzi okno i jaki odsetek aktualizuje.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { fetchVersionPolicy, openStore } from "../../lib/appUpdate";
import { trackUsage } from "../../lib/usage";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";

const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const APP_NAME = "Matury Online";

type Policy = { latestVersion: string; currentVersion: string | null; storeUrl: string | null };

export function UpdatePrompt() {
  const { colors: theme, isDark } = useTheme();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const showing = useRef(false);

  const track = (action: "shown" | "update" | "later", p: Policy) =>
    trackUsage("feature_click", {
      feature: "update_prompt",
      action,
      version: p.latestVersion,
      from: p.currentVersion ?? undefined,
    });

  const check = useCallback(async () => {
    if (showing.current) return;
    const p = await fetchVersionPolicy();
    if (!p?.updateAvailable || !p.latestVersion) return;

    // SecureStore przyjmuje tylko [A-Za-z0-9._-] w kluczu — wersja „1.0.20” pasuje.
    const key = `update_prompt_${p.latestVersion}`;
    const last = Number(await SecureStore.getItemAsync(key).catch(() => null));
    if (last && Date.now() - last < REMIND_AFTER_MS) return;
    await SecureStore.setItemAsync(key, String(Date.now())).catch(() => {});

    showing.current = true;
    const pol: Policy = { latestVersion: p.latestVersion, currentVersion: p.currentVersion, storeUrl: p.storeUrl };
    setPolicy(pol);
    track("shown", pol);
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, [check]);

  const close = (action: "update" | "later") => {
    const p = policy;
    setPolicy(null);
    showing.current = false;
    if (!p) return;
    track(action, p);
    if (action === "update") openStore(p.storeUrl);
  };

  return (
    <Modal visible={!!policy} transparent animationType="fade" onRequestClose={() => close("later")}>
      <Pressable
        onPress={() => close("later")}
        style={{ flex: 1, backgroundColor: "#000000A6", justifyContent: "center", padding: 24 }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 22,
            shadowColor: "#000",
            shadowOpacity: isDark ? 0 : 0.15,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.brand[500] + "1F",
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 26 }}>🚀</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text, marginBottom: 6 }}>
            Nowa wersja {APP_NAME}
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 14 }}>
            W Sklepie Play czeka wersja {policy?.latestVersion}
            {policy?.currentVersion ? ` (masz ${policy.currentVersion})` : ""}. Są w niej poprawki i nowe
            funkcje.
          </Text>
          <View style={{ gap: 6, marginBottom: 18 }}>
            {[
              "Aktualizacja trwa chwilę",
              "Postępy, seria i wyniki zostają na koncie",
            ].map((t) => (
              <View key={t} style={{ flexDirection: "row", gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.brand[500] }}>✓</Text>
                <Text style={{ flex: 1, fontSize: 13.5, color: theme.textSecondary, lineHeight: 19 }}>{t}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => close("update")}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{
              backgroundColor: colors.brand[500],
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>Zaktualizuj teraz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => close("later")}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignItems: "center", paddingVertical: 12, marginTop: 4 }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textSecondary }}>Później</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
