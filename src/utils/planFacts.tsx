// ============================================================================
// Kafelki planów: trzy fakty z dokładnymi datami (Karol 28.09.2026)
// src/utils/planFacts.tsx — ten sam plik w apkach matury / zdaj / osmo.
//
// Jak na webie (SubscriptionPage: PlanFacts, plusOneMonth, plus30Days), tylko
// płatność jest inna: w apce wszystko kupuje się przez Google Play Billing,
// więc linia pod przyciskiem mówi o Google Play, a nie o metodach Stripe.
// Semantyka produktów Play (backend services/play-billing.ts, play-annual.ts):
//   • subskrypcja — Play pobiera od razu i odnawia co miesiąc od dnia zakupu;
//   • Pakiet — jednorazowo, dostęp do daty końca z /stripe/status (annualOffer.play.endDate);
//   • 30 dni — jednorazowo, +30 dni do obecnego końca dostępu albo od dziś.
// ============================================================================

import React from "react";
import { View, Text } from "react-native";

export const PAY_PLAY_SUB = "Płatność przez Google Play · anulujesz w Sklepie Play, kiedy chcesz";
export const PAY_PLAY_ONE_OFF = "Płatność przez Google Play · jednorazowo, bez odnowień";

/** „28 października 2026”. */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Za miesiąc od dziś — dzień odnowienia nowej subskrypcji miesięcznej. */
export function plusOneMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Data końca +30 dni: od obecnego końca dostępu albo od dziś. */
export function plus30Days(endIso?: string | null): string {
  const now = new Date();
  const base = endIso && new Date(endIso) > now ? new Date(endIso) : now;
  base.setDate(base.getDate() + 30);
  return base.toISOString();
}

/** Plakietka Pakietu: oszczędność, gdy przekracza 20 zł, inaczej „30 dni gratis”. */
export function packageBadge(fullPriceZl?: number | null, priceZl?: number | null): string {
  const savings = Math.round((fullPriceZl ?? 0) - (priceZl ?? 0));
  return savings > 20 ? `🎁 OSZCZĘDZASZ ${savings} ZŁ` : "🎁 30 DNI GRATIS";
}

/** Wiersze kafelka: subskrypcja miesięczna kupowana dziś. */
export function subscriptionFacts(price: string | null): [string, string][] {
  return [
    ["Płacisz dziś", price ?? "—"],
    ["Dostęp", "od dziś, co miesiąc"],
    ["Kolejna płatność", `${price ? `${price} — ` : ""}${longDate(plusOneMonth())}`],
  ];
}

/** Wiersze kafelka: zakup jednorazowy (Pakiet albo 30 dni). */
export function oneOffFacts(price: string | null, endIso: string): [string, string][] {
  return [
    ["Płacisz dziś", `${price ?? "—"} — jednorazowo`],
    ["Dostęp do", longDate(endIso)],
    ["Kolejna płatność", "brak — bez odnowień"],
  ];
}

export function PlanFacts({
  rows,
  theme,
}: {
  rows: [string, string][];
  theme: { text: string; textSecondary: string; border: string };
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      {rows.map(([label, value], i) => (
        <View
          key={label}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            paddingVertical: 7,
            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
            borderBottomColor: theme.border,
          }}
        >
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>{label}</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: theme.text,
              textAlign: "right",
              flexShrink: 1,
            }}
          >
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}
