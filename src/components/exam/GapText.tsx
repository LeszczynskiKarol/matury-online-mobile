// =============================================================================
// GapText.tsx — tekst z lukami w arkuszu (wos_fill_text, biz_fill_text,
// info_fill_blank): pole do wpisania stoi W ZDANIU, w miejscu „(1) …………”,
// z numerem luki. Do 29.09.2026 polecenie z kropkami szło jako zwykły tekst,
// a odpowiedź do jednego pola pod spodem (albo do pól „forma 1”, „forma 2”).
//
// RN nie wstawi pola w środek <Text>, więc akapit jest łamany na słowa
// i układany w wierszu z zawijaniem (jak FillInInline w quizie).
// Parser znaczników: utils/gapText.ts. Gdy luk w tekście nie ma (albo nie da
// się ich przypisać), pokazujemy ponumerowane pola z etykietami.
// =============================================================================

import React from "react";
import { View, Text, TextInput } from "react-native";
import { colors } from "../../theme/colors";
import {
  parseGapText,
  gapNumber,
  blankLabel,
  acceptedForBlank,
  blankIsCorrect,
  type GapSegment,
} from "../../utils/gapText";

type Answers = Record<string, string>;

function asAnswers(v: any): Answers {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

const FONT = 16;
const LINE = 34;

function words(text: string): string[] {
  // „słowo ” z doklejoną spacją — spacja niesie odstęp w wierszu flex.
  return text.match(/\S+\s*|\s+/g) || [];
}

function inputWidth(val: string): number {
  return Math.min(Math.max(val.length * 9 + 30, 96), 250);
}

function NumBadge({ num, theme, tone }: { num: string; theme: any; tone?: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "800",
        color: tone || colors.brand[600],
        marginRight: 3,
      }}
    >
      ({num})
    </Text>
  );
}

function Paragraphs({
  paragraphs,
  renderGap,
  theme,
}: {
  paragraphs: GapSegment[][];
  renderGap: (seg: Extract<GapSegment, { kind: "gap" }>, key: string) => React.ReactNode;
  theme: any;
}) {
  const textStyle = { fontSize: FONT, color: theme.text, lineHeight: LINE };
  return (
    <View style={{ gap: 6 }}>
      {paragraphs.map((para, pi) => (
        <View
          key={pi}
          style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}
        >
          {para.map((seg, si) =>
            seg.kind === "gap" ? (
              renderGap(seg, `${pi}-${si}`)
            ) : (
              words(seg.text)
                .filter((w) => w.trim().length > 0)
                .map((w, wi) => (
                <Text key={`${pi}-${si}-${wi}`} style={textStyle}>
                  {w}
                </Text>
              ))
            ),
          )}
        </View>
      ))}
    </View>
  );
}

// ── Odtwarzacz arkusza ───────────────────────────────────────────────────────

export function GapTextInput({
  task,
  value,
  onChange,
  theme,
  isDark,
}: {
  task: any;
  value: any;
  onChange: (v: any) => void;
  theme: any;
  isDark: boolean;
}) {
  const ans = asAnswers(value);
  const blanks: any[] = Array.isArray(task?.content?.blanks) ? task.content.blanks : [];
  const parsed = parseGapText(task);
  const set = (id: string, t: string) => onChange({ ...ans, [id]: t });

  const field = (id: string, num: string, key: string, wide?: boolean) => {
    const v = ans[id] || "";
    return (
      <View
        key={key}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginHorizontal: wide ? 0 : 3,
          marginVertical: 3,
          flex: wide ? 1 : undefined,
        }}
      >
        {!wide && <NumBadge num={num} theme={theme} />}
        <TextInput
          autoComplete="off"
          importantForAutofill="no"
          textContentType="none"
          value={v}
          onChangeText={(t) => set(id, t)}
          placeholder="…"
          placeholderTextColor={theme.textTertiary}
          autoCorrect={false}
          accessibilityLabel={`Luka ${num}`}
          style={{
            width: wide ? undefined : inputWidth(v),
            flex: wide ? 1 : undefined,
            minHeight: 34,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            borderWidth: 1,
            borderBottomWidth: 2,
            borderColor: isDark ? "rgba(34,197,94,0.35)" : colors.brand[200],
            borderBottomColor: colors.brand[500],
            backgroundColor: isDark ? "rgba(34,197,94,0.08)" : colors.brand[50],
            fontSize: FONT,
            fontWeight: "600",
            color: theme.text,
          }}
        />
      </View>
    );
  };

  if (parsed) {
    return (
      <View
        style={{
          padding: 14,
          borderRadius: 14,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <Paragraphs
          paragraphs={parsed.paragraphs}
          theme={theme}
          renderGap={(g, key) => field(g.blankId, g.num, key)}
        />
      </View>
    );
  }

  // Bez luk w tekście — ponumerowane pola z etykietami.
  return (
    <View style={{ gap: 12 }}>
      {blanks.map((b: any, i: number) => {
        const num = gapNumber(b, i);
        const label = blankLabel(b);
        return (
          <View key={String(b.id)}>
            <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 4 }}>
              <NumBadge num={num} theme={theme} />
              {label ? (
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: theme.text }}>
                  {label}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row" }}>{field(String(b.id), num, "f", true)}</View>
          </View>
        );
      })}
    </View>
  );
}

// ── Wyniki arkusza: Twoja odpowiedź w tekście + klucz ────────────────────────

export function GapTextReview({
  task,
  response,
  theme,
  isDark,
}: {
  task: any;
  response: any;
  theme: any;
  isDark: boolean;
}) {
  const ans = asAnswers(response);
  // Starsze podejścia z apki: odpowiedź jednym tekstem (pole pod poleceniem).
  const legacyText = typeof response === "string" && response.trim() ? response.trim() : "";
  const blanks: any[] = Array.isArray(task?.content?.blanks) ? task.content.blanks : [];
  const byId = new Map(blanks.map((b: any) => [String(b.id), b]));
  const parsed = parseGapText(task);
  const okText = isDark ? "#4ade80" : "#16a34a";
  const badText = isDark ? "#f87171" : "#dc2626";
  const okBg = isDark ? "rgba(34,197,94,0.16)" : "#f0fdf4";
  const badBg = isDark ? "rgba(239,68,68,0.16)" : "#fef2f2";
  const neutralBg = isDark ? "rgba(255,255,255,0.08)" : "#f4f4f5";

  const pill = (id: string, num: string, key: string) => {
    if (legacyText) {
      return (
        <View key={key} style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 3 }}>
          <NumBadge num={num} theme={theme} tone={theme.textSecondary} />
          <Text style={{ fontSize: FONT, color: theme.textTertiary }}>…………</Text>
        </View>
      );
    }
    const b = byId.get(id);
    const v = String(ans[id] ?? "").trim();
    const ok = blankIsCorrect(b, v);
    const tone = ok === null ? theme.textSecondary : ok ? okText : badText;
    const acc = acceptedForBlank(b);
    return (
      <View
        key={key}
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          marginHorizontal: 3,
          marginVertical: 3,
        }}
      >
        <NumBadge num={num} theme={theme} tone={tone} />
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            borderBottomWidth: 2,
            borderBottomColor: tone,
            backgroundColor: ok === null ? neutralBg : ok ? okBg : badBg,
          }}
        >
          <Text
            style={{
              fontSize: FONT,
              fontWeight: "700",
              color: v ? tone : theme.textTertiary,
              fontStyle: v ? "normal" : "italic",
              textDecorationLine: ok === false && v ? "line-through" : "none",
            }}
          >
            {v || "brak"}
          </Text>
        </View>
        {ok === false && acc[0] ? (
          <Text style={{ fontSize: FONT, fontWeight: "800", color: okText, marginLeft: 4 }}>
            → {acc[0]}
          </Text>
        ) : null}
      </View>
    );
  };

  const keyList = blanks
    .map((b: any, i: number) => ({ b, i, acc: acceptedForBlank(b) }))
    .filter((x) => x.acc.length > 0);
  const numOf = (id: string, i: number) => {
    if (parsed) {
      for (const p of parsed.paragraphs)
        for (const s of p) if (s.kind === "gap" && s.blankId === id) return s.num;
    }
    return gapNumber(byId.get(id), i);
  };

  return (
    <View style={{ gap: 10 }}>
      {parsed ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Paragraphs
            paragraphs={parsed.paragraphs}
            theme={theme}
            renderGap={(g, key) => pill(g.blankId, g.num, key)}
          />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {blanks.map((b: any, i: number) => (
            <View key={String(b.id)}>
              {blankLabel(b) ? (
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textSecondary, marginBottom: 2 }}>
                  {blankLabel(b)}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row" }}>{pill(String(b.id), gapNumber(b, i), "p")}</View>
            </View>
          ))}
        </View>
      )}

      {legacyText ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>{legacyText}</Text>
        </View>
      ) : null}

      {keyList.length > 0 && (
        <View
          style={{
            padding: 10,
            borderRadius: 12,
            backgroundColor: okBg,
            borderWidth: 1,
            borderColor: isDark ? "#065f46" : "#a7f3d0",
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "800", color: okText, letterSpacing: 1 }}>
            AKCEPTOWANE ODPOWIEDZI
          </Text>
          {keyList.map(({ b, i, acc }) => (
            <Text key={String(b.id)} style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
              <Text style={{ fontWeight: "800", color: okText }}>({numOf(String(b.id), i)}) </Text>
              {acc.join(" / ")}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
