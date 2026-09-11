// ============================================================================
// UpdatePrompt — łagodna podpowiedź „jest nowa wersja”
// Nic nie renderuje. Przy starcie i po powrocie na pierwszy plan pyta backend
// o najnowszą wersję; jeśli zainstalowana jest starsza, pokazuje okienko
// „Aktualizuj / Później”. Po „Później” wraca dopiero po REMIND_AFTER_MS —
// nie męczymy kogoś, kto świadomie nie chce aktualizować. Nie blokuje apki.
// ============================================================================

import { useCallback, useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { fetchVersionPolicy, openStore } from "../../lib/appUpdate";

const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export function UpdatePrompt() {
  const showing = useRef(false);

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
    Alert.alert(
      "Nowa wersja aplikacji",
      "Jest dostępna nowsza wersja Matury Online z poprawkami i nowościami. Zaktualizujesz teraz?",
      [
        { text: "Później", style: "cancel", onPress: () => { showing.current = false; } },
        {
          text: "Aktualizuj",
          onPress: () => {
            showing.current = false;
            openStore(p.storeUrl);
          },
        },
      ],
      { cancelable: true, onDismiss: () => { showing.current = false; } },
    );
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, [check]);

  return null;
}
