// ============================================================================
// TestimonialPrompt — prośba o opinię w momencie satysfakcji (po arkuszu, przy
// serii dni nauki, po diagnozie). Port webowego
// matury-online.pl/frontend/src/components/feedback/TestimonialPrompt.tsx.
//
// Dwa kroki: klik w gwiazdkę zapisuje ocenę od razu (pisanie zdań to
// największa bariera), tekst jest opcjonalny. Zgoda na publikację to OSOBNY
// checkbox — bez niej opinia zostaje u nas jako feedback i nigdy nie trafia na
// stronę; podpis uczeń widzi i akceptuje przed wysłaniem.
//
// Karta w treści ekranu, nie modal — nie zasłania wyniku. Zamknięcie (albo
// samo ocenienie) ucisza prośbę na DISMISS_DAYS; backend i tak pyta konto
// tylko raz (/testimonials/eligibility).
// ============================================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { colors } from "../../theme/colors";
import { fontFamily, radius, spacing } from "../../theme";
import {
  getTestimonialEligibility,
  submitTestimonial,
  trackTestimonialImpression,
  type TestimonialTrigger,
} from "../../api/testimonials";
import { maybeAskForReview } from "../../lib/reviewPrompt";

// ── Marka ─────────────────────────────────────────────────────────────────
const TITLES: Record<TestimonialTrigger, string> = {
  exam: "Jak Ci się pracuje z arkuszami?",
  streak: "Jak Ci się z nami uczy?",
  diagnosis: "Jak oceniasz matury-online.pl?",
};
// Prośba o opinię i propozycje zmian (Karol 2.10.2026). Wyzwalacz „streak”
// zostaje, ale tekst nie wspomina serii.
const INTRO =
  "Każda opinia pomaga nam ulepszać aplikację. Napisz, co działa, co przeszkadza albo czego brakuje. Czytamy wszystko.";
const LABEL_PLACEHOLDER = "np. Ola, 4 LO";

// ── Stałe ─────────────────────────────────────────────────────────────────
const DISMISS_KEY = "testimonial_dismissed_at";
const DISMISS_DAYS = 60;
const MIN_LEN = 10;
const MAX_LEN = 600;
const MAX_LABEL = 60;
const STAR = "#f59e0b";

async function dismissedRecently(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

function remember() {
  SecureStore.setItemAsync(DISMISS_KEY, String(Date.now())).catch(() => {});
}

/** Imię (pierwsze słowo nazwy) — nigdy e-mail: rejestracja bez imienia wpisuje tam adres. */
function firstNameOf(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  return first.includes("@") ? "" : first;
}

export function TestimonialPrompt({
  trigger,
  context,
  style,
}: {
  trigger: TestimonialTrigger;
  context?: Record<string, unknown>;
  style?: ViewStyle;
}) {
  const { colors: theme, isDark } = useTheme();
  const { user } = useAuth();

  // Podpis domyślnie samym imieniem — uczeń może go zmienić przed wysłaniem.
  const defaultLabel = firstNameOf(user?.name);

  const [show, setShow] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [quote, setQuote] = useState("");
  const [consent, setConsent] = useState(false);
  const [label, setLabel] = useState(defaultLabel);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      if (await dismissedRecently()) return;
      try {
        const d = await getTestimonialEligibility();
        if (!alive || !d?.eligible) return;
        setShow(true);
        trackTestimonialImpression(trigger).catch(() => {});
      } catch {
        // prośba jest opcjonalna — błąd sieci po prostu jej nie pokazuje
      }
    })();
    return () => {
      alive = false;
    };
  }, [trigger, userId]);

  // Imię dociera czasem po pierwszym renderze (odświeżenie profilu).
  useEffect(() => {
    if (!label && defaultLabel) setLabel(defaultLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLabel]);

  // 5★ → natywne okienko oceny Google Play (in-app review; helper sam pilnuje
  // limitu i cicho nic nie robi, gdy Play go nie pokaże).
  useEffect(() => {
    // Każda ocena, nie tylko 5★ — pytanie o zdanie przed oknem oceny Google
    // Play to „review gating”, zakazany w regulaminie sklepu.
    if (done) maybeAskForReview(100);
  }, [done, rating]);

  const send = (payload: Record<string, unknown>) =>
    submitTestimonial({ trigger, context, ...payload });

  const dismiss = () => {
    remember();
    setShow(false);
  };

  // Krok 1: gwiazdka zapisuje się od razu — nawet jeśli nic nie dopiszesz.
  const rate = async (n: number) => {
    setRating(n);
    setError(null);
    remember();
    try {
      await send({ rating: n });
    } catch (e: any) {
      setError(e?.message || "Nie udało się wysłać.");
    }
  };

  // Krok 2 (opcjonalny): tekst nadpisuje wpis z oceną, dopóki czeka na moderację.
  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      await send({
        rating,
        quote: quote.trim(),
        consentPublic: consent,
        authorLabel: consent ? label.trim() : undefined,
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Nie udało się wysłać.");
    } finally {
      setSending(false);
    }
  };

  if (!show) return null;

  const cardStyle: ViewStyle = {
    borderColor: isDark ? colors.brand[800] + "66" : colors.brand[200],
    ...style,
  };
  const titleStyle = {
    flex: 1,
    fontFamily: fontFamily.display.semibold,
    fontSize: 15,
    color: theme.text,
  } as const;
  const smallText = {
    fontFamily: fontFamily.body.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.textSecondary,
  } as const;

  const CloseButton = (
    <TouchableOpacity
      onPress={dismiss}
      accessibilityRole="button"
      accessibilityLabel="Zamknij"
      hitSlop={10}
      style={{ padding: 2 }}
    >
      <Ionicons name="close" size={18} color={theme.textTertiary} />
    </TouchableOpacity>
  );

  if (done) {
    return (
      <Card style={cardStyle}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[3] }}>
          <Text style={titleStyle}>Dziękujemy! Przeczytamy każde słowo.</Text>
          {CloseButton}
        </View>
        {quote.trim().length > 0 && (
          <Text style={[smallText, { marginTop: spacing[1.5] }]}>
            {consent
              ? "Jeśli opinia trafi na stronę, podpiszemy ją dokładnie tak, jak ustaliliśmy."
              : "Opinia zostaje u nas i nigdzie jej nie opublikujemy."}
          </Text>
        )}
      </Card>
    );
  }

  const tooShort = quote.trim().length < MIN_LEN;
  const needsLabel = consent && !label.trim();

  return (
    <Card style={cardStyle}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[3] }}>
        <Text style={titleStyle}>
          {rating == null ? TITLES[trigger] : "Dzięki! Napiszesz, co poprawić albo dodać?"}
        </Text>
        {CloseButton}
      </View>
      {rating == null && <Text style={[smallText, { marginTop: spacing[1] }]}>{INTRO}</Text>}

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Ocena od 1 do 5"
        style={{ flexDirection: "row", gap: spacing[1], marginTop: spacing[2.5] }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= (rating ?? 0);
          return (
            <TouchableOpacity
              key={n}
              onPress={() => rate(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: rating === n }}
              accessibilityLabel={`${n} na 5`}
              hitSlop={4}
              style={{ padding: 2 }}
            >
              <Ionicons
                name={on ? "star" : "star-outline"}
                size={30}
                color={on ? STAR : isDark ? colors.zinc[600] : colors.zinc[300]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Pole na tekst widoczne od razu pod gwiazdkami (Karol 27.09.2026). */}
      {(
        <View style={{ marginTop: spacing[3], gap: spacing[2.5] }}>
          <TextInput
            value={quote}
            onChangeText={(t) => setQuote(t.slice(0, MAX_LEN))}
            multiline
            textAlignVertical="top"
            maxLength={MAX_LEN}
            placeholder={
              rating == null
                ? "Co działa, co przeszkadza, czego brakuje? (opcjonalnie)"
                : rating >= 4
                ? "Co pomaga, a co warto zmienić? (opcjonalnie)"
                : "Co przeszkadza albo czego brakuje? (opcjonalnie)"
            }
            placeholderTextColor={theme.textTertiary}
            style={{
              minHeight: 56,
              backgroundColor: theme.inputBg,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: radius.xl,
              paddingHorizontal: spacing[3.5],
              paddingVertical: spacing[3],
              fontFamily: fontFamily.body.regular,
              fontSize: 14,
              color: theme.text,
            }}
          />
          {quote.length > 0 && tooShort && (
            <Text style={[smallText, { color: theme.textTertiary }]}>
              Jeszcze {MIN_LEN - quote.trim().length} zn. — albo zostań przy samej ocenie.
            </Text>
          )}

          {!tooShort && (
            <TouchableOpacity
              onPress={() => setConsent((c) => !c)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2] }}
            >
              <Ionicons
                name={consent ? "checkbox" : "square-outline"}
                size={20}
                color={consent ? colors.brand[500] : theme.textTertiary}
              />
              <Text style={[smallText, { flex: 1, color: theme.textSecondary }]}>
                Możecie użyć tego na stronie i podpisać mnie tak:
              </Text>
            </TouchableOpacity>
          )}

          {consent && !tooShort && (
            <>
              <TextInput
                value={label}
                onChangeText={(t) => setLabel(t.slice(0, MAX_LABEL))}
                maxLength={MAX_LABEL}
                placeholder={LABEL_PLACEHOLDER}
                placeholderTextColor={theme.textTertiary}
                style={{
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: needsLabel ? colors.red[500] : theme.border,
                  borderRadius: radius.xl,
                  paddingHorizontal: spacing[3.5],
                  paddingVertical: spacing[2.5],
                  fontFamily: fontFamily.body.regular,
                  fontSize: 14,
                  color: theme.text,
                }}
              />
              {/* Podgląd — dokładnie tak opinia wyglądałaby na stronie. */}
              <View
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colors.brand[500],
                  paddingLeft: spacing[3],
                  paddingVertical: spacing[1],
                }}
              >
                <Text
                  numberOfLines={3}
                  style={{
                    fontFamily: fontFamily.body.italic,
                    fontStyle: "italic",
                    fontSize: 13,
                    lineHeight: 19,
                    color: theme.text,
                  }}
                >
                  „{quote.trim()}”
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamily.body.semibold,
                    fontSize: 12,
                    marginTop: 2,
                    color: theme.textSecondary,
                  }}
                >
                  — {label.trim() || "…"}
                </Text>
              </View>
            </>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
            <Button
              title="Wyślij"
              size="sm"
              onPress={submit}
              loading={sending}
              disabled={sending || tooShort || needsLabel}
            />
            {rating != null && (
              <TouchableOpacity onPress={() => setDone(true)} hitSlop={8}>
                <Text style={[smallText, { fontFamily: fontFamily.body.semibold }]}>
                  Wystarczy ocena
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {error && (
        <Text style={[smallText, { color: colors.red[500], marginTop: spacing[2] }]}>
          {error}
        </Text>
      )}
    </Card>
  );
}
