// ============================================================================
// FreePackText — komunikat „darmowy pakiet startowy już wykorzystany” z linkami
// src/components/common/FreePackText.tsx
//
// Backend (services/free-pack.ts) wysyła gotowy tekst: dlaczego pakiet nie
// przysługuje, zamaskowany adres konta, które go wykorzystało, i jak zgłosić
// pomyłkę („…przez formularz kontaktowy albo na adres kontakt@…”). Apka nie ma
// własnego ekranu kontaktu, więc „formularz kontaktowy” otwiera formularz na
// stronie, a adres otwiera pocztę (mailto). Zamaskowanego adresu innego konta
// nie linkujemy (regex łapie tylko kontakt@…).
//
// Zwraca fragment do wstawienia WEWNĄTRZ <Text> (zagnieżdżone <Text onPress>).
// ============================================================================

import React from "react";
import { Linking, Text } from "react-native";
import { colors } from "../../theme/colors";
import { FREE_PACK_BLOCKED_MESSAGE } from "../../api/premium";

/** Formularz kontaktowy na stronie (w panelu: ikona koperty na dole panelu bocznego). */
export const CONTACT_FORM_URL = "https://www.matury-online.pl/dashboard/kontakt";

const CONTACT_RE = /(formularz kontaktowy|kontakt@[a-z0-9-]+(?:\.[a-z0-9-]+)+)/;

export function FreePackText({
  message,
  linkColor,
}: {
  /** freePackMessage / message z backendu; brak = stały tekst. */
  message?: string | null;
  linkColor?: string;
}) {
  const parts = (message || FREE_PACK_BLOCKED_MESSAGE).split(CONTACT_RE);
  const linkStyle = {
    color: linkColor ?? colors.brand[500],
    fontWeight: "700" as const,
    textDecorationLine: "underline" as const,
  };
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          p
        ) : (
          <Text
            key={i}
            style={linkStyle}
            accessibilityRole="link"
            onPress={() =>
              Linking.openURL(p === "formularz kontaktowy" ? CONTACT_FORM_URL : `mailto:${p}`).catch(() => {})
            }
          >
            {p}
          </Text>
        ),
      )}
    </>
  );
}
