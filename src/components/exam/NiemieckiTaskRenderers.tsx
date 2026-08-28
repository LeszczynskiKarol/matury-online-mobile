// =============================================================================
// NiemieckiTaskRenderers.tsx (mobile)
// 1:1 z frontend/src/components/exam/NiemieckiTaskRenderers.tsx
// =============================================================================

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import { useListeningPlayer } from "../../hooks/useListeningPlayer";

// ── Types ──────────────────────────────────────────────────────────────────

interface RenderProps {
  task: any;
  answers: Record<string, any>;
  onAnswer: (questionId: string, value: any) => void;
  theme: any;
  isDark: boolean;
}

// Wszystkie typy językowe — PL bare names (Angielski PP) + _de (Niemiecki PP)
// + _pr / _pr_de (poziom rozszerzony). Identyczne UX EN/DE.
const LANGUAGE_TASK_TYPES = new Set([
  // Listening
  "listening_matching", "listening_matching_de",
  "listening_mcq", "listening_mcq_de",
  "listening_fill", "listening_fill_de",
  "listening_mcq_pr", "listening_mcq_pr_de",
  // Reading
  "reading_heading_match", "reading_heading_match_de",
  "reading_mixed", "reading_mixed_de",
  "reading_mcq", "reading_mcq_de",
  "reading_gapped_text", "reading_gapped_text_de",
  "reading_paragraph_match", "reading_paragraph_match_de",
  "reading_gapped_text_pr", "reading_gapped_text_pr_de",
  "reading_two_texts", "reading_two_texts_de",
  // Use of language
  "mini_dialogues", "mini_dialogues_de",
  "both_sentences", "both_sentences_de",
  "open_cloze", "open_cloze_de",
  "transformation", "transformation_de",
  "mcq_cloze", "mcq_cloze_de",
  "word_formation",
  "sentence_completion_pr",
  "sentence_transform_pr_de",
  "word_three_sentences_de",
  // Writing
  "writing_eng", "writing_eng_pr", "writing_de", "writing_de_pr",
]);

export function isGermanTaskType(type: string): boolean {
  return LANGUAGE_TASK_TYPES.has(type);
}

// Normalizuj wariant językowy → wspólny key dla switcha rendererów.
// "listening_matching_de" → "listening_matching"
// "listening_mcq_pr_de" → "listening_mcq_pr"
// "writing_eng" / "writing_de" → "writing"
function normalizeLangType(t: string): string {
  if (t === "writing_eng" || t === "writing_de") return "writing";
  if (t === "writing_eng_pr" || t === "writing_de_pr") return "writing_pr";
  return t.replace(/_de$/, "");
}

// Normalize MCQ options (dict OR array)
function normalizeOptions(opts: unknown): Array<[string, string]> {
  if (!opts) return [];
  if (Array.isArray(opts)) {
    return opts.map((o: any, i: number): [string, string] => {
      if (o && typeof o === "object") {
        const id = String(o.id ?? o.key ?? i);
        const text =
          typeof o.text === "string"
            ? o.text
            : String(o.text ?? o.label ?? "");
        return [id, text];
      }
      return [String(i), String(o ?? "")];
    });
  }
  if (typeof opts === "object") {
    return Object.entries(opts).map(([k, v]): [string, string] => {
      if (v && typeof v === "object") {
        return [
          k,
          typeof (v as any).text === "string"
            ? (v as any).text
            : String((v as any).text ?? ""),
        ];
      }
      return [k, String(v ?? "")];
    });
  }
  return [];
}

// ── Audio player ───────────────────────────────────────────────────────────

function AudioBanner({ task, theme, isDark }: { task: any; theme: any; isDark: boolean }) {
  const audioUrl = task.content?.audioUrl;
  const barWidthRef = useRef(0);
  const maxPlays = 2;
  const {
    playsLeft,
    loaded,
    isPlaying,
    loading,
    error,
    positionMs: currentMs,
    durationMs,
    progress,
    handlePlay,
    handleStop,
    seekToFraction,
  } = useListeningPlayer({
    src: audioUrl || null,
    maxPlays,
    initialDurationMs: task.content?.audioDurationMs || 0,
  });
  const canStart = playsLeft > 0 && !!audioUrl;

  const handleSeek = useCallback(
    (x: number) => {
      const w = barWidthRef.current;
      if (!w) return;
      seekToFraction(x / w);
    },
    [seekToFraction],
  );

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  if (!audioUrl) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: 16,
          backgroundColor: isDark ? "#92400e15" : "#fffbeb",
          borderWidth: 1,
          borderColor: isDark ? "#92400e40" : "#fde68a",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 16 }}>⚠️</Text>
        <Text
          style={{
            fontSize: 13,
            color: isDark ? "#fbbf24" : "#92400e",
            flex: 1,
          }}
        >
          Audio jeszcze nie wygenerowane. Odśwież za chwilę.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: isDark ? "#0c1e3e" : "#eff6ff",
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: isDark ? "#1e40af40" : "#bfdbfe",
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            color: isDark ? "#60a5fa" : "#1d4ed8",
            letterSpacing: 0.5,
          }}
        >
          🎧 NAGRANIE
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "600",
            color: isDark ? "#93c5fd" : "#1e40af",
          }}
        >
          Pozostało: {playsLeft}/{maxPlays}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity
          onPress={handlePlay}
          disabled={loading || (!loaded && !canStart)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: loaded || canStart ? "#2563eb" : "#94a3b8",
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isPlaying ? (
            <View style={{ flexDirection: "row", gap: 3 }}>
              <View
                style={{
                  width: 4,
                  height: 14,
                  borderRadius: 1.5,
                  backgroundColor: "#fff",
                }}
              />
              <View
                style={{
                  width: 4,
                  height: 14,
                  borderRadius: 1.5,
                  backgroundColor: "#fff",
                }}
              />
            </View>
          ) : (
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 12,
                borderTopWidth: 8,
                borderBottomWidth: 8,
                borderLeftColor: "#fff",
                borderTopColor: "transparent",
                borderBottomColor: "transparent",
                marginLeft: 3,
              }}
            />
          )}
        </TouchableOpacity>

        {/* Stop — widoczny gdy nagranie jest załadowane */}
        {loaded && (
          <TouchableOpacity
            onPress={handleStop}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark ? "#1e3a8a40" : "#dbeafe",
            }}
          >
            <View
              style={{
                width: 13,
                height: 13,
                borderRadius: 3,
                backgroundColor: "#2563eb",
              }}
            />
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          {/* Progress — dotknij/przeciągnij, aby przewinąć */}
          <View
            onLayout={(e) => {
              barWidthRef.current = e.nativeEvent.layout.width;
            }}
            onStartShouldSetResponder={() => loaded}
            onMoveShouldSetResponder={() => loaded}
            onResponderGrant={(e) => handleSeek(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleSeek(e.nativeEvent.locationX)}
            style={{ paddingVertical: 10, marginVertical: -10 }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: isDark ? "#1e3a8a40" : "#dbeafe",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: "#2563eb",
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: isDark ? "#93c5fd" : "#1e40af",
                fontVariant: ["tabular-nums"],
              }}
            >
              {fmt(currentMs)}
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: isDark ? "#93c5fd" : "#1e40af",
                fontVariant: ["tabular-nums"],
              }}
            >
              {fmt(durationMs)}
            </Text>
          </View>
        </View>
      </View>

      {/* Błąd odtwarzania — limit nie został zużyty */}
      {error && (
        <View
          style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 10,
            backgroundColor: colors.red[500] + "15",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.red[500],
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Transcript panel ───────────────────────────────────────────────────────

function TranscriptPanel({
  transcript,
  theme,
  isDark,
}: {
  transcript: string;
  theme: any;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!transcript) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 10,
          backgroundColor: isDark ? "#312e8120" : "#eef2ff",
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: isDark ? "#a5b4fc" : "#4f46e5",
          }}
        >
          {open ? "▾ Ukryj transkrypcję" : "▸ Pokaż transkrypcję"}
        </Text>
      </TouchableOpacity>
      {open && (
        <View
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
            maxHeight: 240,
          }}
        >
          <ScrollView>
            <Text
              style={{
                fontSize: 12,
                color: theme.text,
                lineHeight: 18,
              }}
            >
              {transcript}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Pill picker (mobile substitute for <select>) ───────────────────────────

function PillPicker({
  options,
  value,
  onChange,
  usedValues,
  theme,
  isDark,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  usedValues?: Set<string>;
  theme: any;
  isDark: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((opt) => {
        const isSelected = value === opt;
        const isUsedByOther = !!usedValues?.has(opt) && opt !== value;
        return (
          <TouchableOpacity
            key={opt}
            disabled={isUsedByOther}
            onPress={() => onChange(isSelected ? "" : opt)}
            style={{
              minWidth: 38,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 2,
              borderColor: isSelected
                ? colors.brand[500]
                : isUsedByOther
                  ? theme.border
                  : theme.border,
              backgroundColor: isSelected
                ? colors.brand[500] + "1A"
                : isUsedByOther
                  ? theme.inputBg
                  : "transparent",
              opacity: isUsedByOther ? 0.35 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: isSelected
                  ? colors.brand[600]
                  : isUsedByOther
                    ? theme.textTertiary
                    : theme.text,
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── OptionCard (single MCQ option) ─────────────────────────────────────────

function MCQOption({
  label,
  text,
  selected,
  onPress,
  theme,
  isDark,
}: {
  label: string;
  text: string;
  selected: boolean;
  onPress: () => void;
  theme: any;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: selected ? colors.brand[500] : theme.border,
        backgroundColor: selected ? colors.brand[500] + "15" : theme.inputBg,
        flexDirection: "row",
        gap: 8,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: selected ? colors.brand[600] : theme.text,
        }}
      >
        {label}.
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: theme.text,
          flex: 1,
          lineHeight: 20,
        }}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTENING_MATCHING_DE
// ─────────────────────────────────────────────────────────────────────────────

function ListeningMatchingDe({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const rawSpeakers = content.speakers || [];
  const speakers = rawSpeakers.map((s: any) =>
    typeof s === "string"
      ? { id: s, label: s }
      : {
          id: s.id,
          label: s.label || s.name || s.id,
          transcript: s.transcript,
        },
  );
  const rawStatements = content.statements;
  const statementMap: Record<string, string> = {};
  if (Array.isArray(rawStatements)) {
    for (const s of rawStatements) {
      if (s && typeof s === "object" && s.id) {
        statementMap[s.id] =
          typeof s.text === "string" ? s.text : String(s.text ?? "");
      }
    }
  } else if (rawStatements && typeof rawStatements === "object") {
    for (const [k, v] of Object.entries(rawStatements)) {
      statementMap[k] =
        typeof v === "string" ? v : (v as any)?.text ?? String(v ?? "");
    }
  }
  const statementKeys = Object.keys(statementMap).sort();

  const usedValues = useMemo(() => {
    const used = new Set<string>();
    speakers.forEach((s: any) => {
      const val = answers[s.id];
      if (val) used.add(val);
    });
    return used;
  }, [speakers, answers]);

  const transcriptText = speakers.some((s: any) => s.transcript)
    ? speakers
        .map((s: any) => `${s.label}\n${s.transcript || ""}`)
        .join("\n\n")
    : content.transcript || "";

  return (
    <View>
      <AudioBanner task={task} theme={theme} isDark={isDark} />
      {transcriptText && (
        <TranscriptPanel
          transcript={transcriptText}
          theme={theme}
          isDark={isDark}
        />
      )}

      {/* Statements A–F */}
      <View
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: theme.inputBg,
          marginBottom: 16,
          gap: 6,
        }}
      >
        {statementKeys.map((key) => (
          <View key={key} style={{ flexDirection: "row", gap: 8 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: theme.text,
                minWidth: 22,
              }}
            >
              {key}.
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.text,
                flex: 1,
                lineHeight: 19,
              }}
            >
              {statementMap[key]}
            </Text>
          </View>
        ))}
      </View>

      {/* Speakers 1–5 with pickers */}
      <View style={{ gap: 10 }}>
        {speakers.map((speaker: any) => (
          <View
            key={speaker.id}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: colors.navy[500],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}
                >
                  {speaker.id}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.textSecondary,
                  flex: 1,
                }}
              >
                {speaker.label}
              </Text>
            </View>
            <PillPicker
              options={statementKeys}
              value={answers[speaker.id] || ""}
              onChange={(v) => onAnswer(speaker.id, v)}
              usedValues={usedValues}
              theme={theme}
              isDark={isDark}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTENING_MCQ_DE — MCQ z 2-3 nagrań
// ─────────────────────────────────────────────────────────────────────────────

function ListeningMcqDe({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const texts = Array.isArray(content.texts) ? content.texts : [];

  return (
    <View>
      <AudioBanner task={task} theme={theme} isDark={isDark} />

      {texts.map((text: any) => (
        <View key={text.id} style={{ marginBottom: 20 }}>
          {text.label && (
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: theme.text,
                marginBottom: 10,
              }}
            >
              {text.label}
            </Text>
          )}

          <View style={{ gap: 14 }}>
            {(text.questions || []).map((q: any) => (
              <View
                key={q.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: theme.text,
                    marginBottom: 10,
                    lineHeight: 20,
                  }}
                >
                  {q.id}. {q.question}
                </Text>
                <View style={{ gap: 8 }}>
                  {normalizeOptions(q.options).map(([key, val]) => (
                    <MCQOption
                      key={key}
                      label={key}
                      text={val}
                      selected={answers[q.id] === key}
                      onPress={() =>
                        onAnswer(q.id, answers[q.id] === key ? "" : key)
                      }
                      theme={theme}
                      isDark={isDark}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>

          {text.transcript && (
            <View style={{ marginTop: 10 }}>
              <TranscriptPanel
                transcript={text.transcript}
                theme={theme}
                isDark={isDark}
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTENING_FILL_DE — notatka z lukami, każda luka po niemiecku
// ─────────────────────────────────────────────────────────────────────────────

function ListeningFillDe({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const items = (content.gaps || content.questions || []) as any[];
  const template: string = content.noteTemplate || "";

  // Czy szablon zawiera markery luk?
  const templateHasGaps =
    template && items.some((it: any) => template.includes(it.id));

  // Regex łapie np. "3.1. _______" lub "3.1 ___"
  const idPattern = items
    .map((it: any) => String(it.id || "").replace(/\./g, "\\."))
    .filter(Boolean)
    .join("|");

  const renderLine = (line: string, lineIdx: number) => {
    if (!idPattern) {
      return (
        <Text
          key={lineIdx}
          style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}
        >
          {line || " "}
        </Text>
      );
    }
    const regex = new RegExp(`(${idPattern})\\.?\\s*_+`, "g");
    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = regex.exec(line))) {
      const before = line.slice(lastIdx, m.index);
      if (before) {
        nodes.push(
          <Text
            key={`t${key++}`}
            style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}
          >
            {before}
          </Text>,
        );
      }
      const gapId = m[1];
      nodes.push(
        <View
          key={`g${key++}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: isDark ? "#60a5fa" : "#2563eb",
            }}
          >
            {gapId}.
          </Text>
          <TextInput
            value={answers[gapId] || ""}
            onChangeText={(t) => onAnswer(gapId, t)}
            placeholder="…"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              minWidth: 110,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderBottomWidth: 2,
              borderBottomColor: isDark ? "#3b82f6" : "#60a5fa",
              fontSize: 13,
              color: theme.text,
              fontWeight: "600",
            }}
          />
        </View>,
      );
      lastIdx = m.index + m[0].length;
    }
    const after = line.slice(lastIdx);
    if (after) {
      nodes.push(
        <Text
          key={`t${key++}`}
          style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}
        >
          {after}
        </Text>,
      );
    }
    if (nodes.length === 0) {
      nodes.push(
        <Text
          key="empty"
          style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}
        >
          {" "}
        </Text>,
      );
    }
    return (
      <View
        key={lineIdx}
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        {nodes}
      </View>
    );
  };

  return (
    <View>
      <AudioBanner task={task} theme={theme} isDark={isDark} />

      {templateHasGaps ? (
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: isDark ? "#78350f15" : "#fffbeb",
            borderWidth: 1,
            borderColor: isDark ? "#92400e40" : "#fde68a",
            marginBottom: 12,
          }}
        >
          {template.split("\n").map(renderLine)}
        </View>
      ) : (
        <>
          {template && (
            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: isDark ? "#78350f15" : "#fffbeb",
                borderWidth: 1,
                borderColor: isDark ? "#92400e40" : "#fde68a",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}>
                {template}
              </Text>
            </View>
          )}
          <Text
            style={{
              fontSize: 12,
              fontStyle: "italic",
              color: theme.textSecondary,
              marginBottom: 10,
            }}
          >
            Luki należy uzupełnić w języku niemieckim.
          </Text>
          <View style={{ gap: 10 }}>
            {items.map((q: any) => (
              <View
                key={q.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: theme.text,
                    minWidth: 40,
                  }}
                >
                  {q.id}
                </Text>
                {q.blankLabel && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.textSecondary,
                      minWidth: 110,
                    }}
                  >
                    {q.blankLabel}:
                  </Text>
                )}
                <TextInput
                  value={answers[q.id] || ""}
                  onChangeText={(t) => onAnswer(q.id, t)}
                  placeholder="Wpisz odpowiedź po niemiecku"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    backgroundColor: theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 14,
                    color: theme.text,
                  }}
                />
              </View>
            ))}
          </View>
        </>
      )}

      <TranscriptPanel
        transcript={content.transcript || ""}
        theme={theme}
        isDark={isDark}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// READING_MCQ — MCQ A/B/C/D z dłuższego tekstu (PP)
// ─────────────────────────────────────────────────────────────────────────────

function ReadingMcq({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  // Backend ma 2 kształty: content.items (nowy, mixed mcq+open) lub content.questions (legacy)
  const rawItems: any[] =
    (Array.isArray(content.items) && content.items.length > 0
      ? content.items
      : Array.isArray(content.questions)
        ? content.questions
        : []) || [];

  // Texts (legacy reading_two_texts shape) — render every passage if present
  const texts = Array.isArray(content.texts) ? content.texts : [];

  return (
    <View>
      {content.textTitle && (
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: theme.text,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {content.textTitle}
        </Text>
      )}

      {/* Passage (jeden duży tekst) */}
      {content.passage && (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.inputBg,
            marginBottom: 14,
            maxHeight: 320,
          }}
        >
          <ScrollView nestedScrollEnabled>
            <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
              {content.passage}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Kilka tekstów (legacy two_texts) */}
      {texts.map((t: any) => (
        <View
          key={t.id}
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.inputBg,
            marginBottom: 12,
          }}
        >
          {t.title && (
            <Text style={{ fontSize: 13, fontWeight: "800", color: theme.text, marginBottom: 6 }}>
              Tekst {t.id}. {t.title}
            </Text>
          )}
          <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
            {t.text || t.content || ""}
          </Text>
        </View>
      ))}

      <View style={{ gap: 14 }}>
        {rawItems.map((q: any) => {
          // MCQ jeśli ma options; "open" jeśli type === "open" lub brak options
          const isMcq =
            (q.type ? q.type === "mcq" : Array.isArray(q.options) && q.options.length > 0);
          return (
            <View
              key={q.id}
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: theme.text,
                  marginBottom: 10,
                  lineHeight: 20,
                }}
              >
                {q.id}. {q.question || q.statement || ""}
              </Text>
              {isMcq ? (
                <View style={{ gap: 8 }}>
                  {normalizeOptions(q.options).map(([key, val]) => (
                    <MCQOption
                      key={key}
                      label={key}
                      text={val}
                      selected={answers[q.id] === key}
                      onPress={() =>
                        onAnswer(q.id, answers[q.id] === key ? "" : key)
                      }
                      theme={theme}
                      isDark={isDark}
                    />
                  ))}
                </View>
              ) : (
                <TextInput
                  value={answers[q.id] || ""}
                  onChangeText={(t) => onAnswer(q.id, t)}
                  placeholder={
                    q.contextAfter
                      ? "Wpisz odpowiedź..."
                      : "Odpowiedz pełnym zdaniem..."
                  }
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  autoCorrect={false}
                  style={{
                    backgroundColor: theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 14,
                    color: theme.text,
                    minHeight: 60,
                    textAlignVertical: "top",
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// READING_HEADING_MATCH — dopasuj nagłówki A-F do akapitów
// ─────────────────────────────────────────────────────────────────────────────

function ReadingHeadingMatch({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const headings: Record<string, string> = Object.fromEntries(
    normalizeOptions(content.headings),
  );
  const rawSections = Array.isArray(content.sections)
    ? content.sections
    : Array.isArray(content.texts)
      ? content.texts
      : [];
  const sections = rawSections.map((s: any) => ({
    id: String(s?.id ?? ""),
    text:
      typeof s?.text === "string"
        ? s.text
        : typeof s?.content === "string"
          ? s.content
          : String(s?.text ?? s?.content ?? ""),
  }));
  const headingKeys = Object.keys(headings).sort();

  const usedValues = useMemo(() => {
    const used = new Set<string>();
    sections.forEach((s: any) => {
      const v = answers[s.id];
      if (v) used.add(v);
    });
    return used;
  }, [sections, answers]);

  return (
    <View>
      {/* Lista nagłówków */}
      <View
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: theme.inputBg,
          marginBottom: 14,
          gap: 6,
        }}
      >
        {headingKeys.map((k) => (
          <View key={k} style={{ flexDirection: "row", gap: 8 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: theme.text,
                minWidth: 22,
              }}
            >
              {k}.
            </Text>
            <Text style={{ fontSize: 13, color: theme.text, flex: 1, lineHeight: 19 }}>
              {headings[k]}
            </Text>
          </View>
        ))}
      </View>

      {content.textTitle && (
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: theme.text,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {content.textTitle}
        </Text>
      )}

      <View style={{ gap: 12 }}>
        {sections.map((s: any) => (
          <View
            key={s.id}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: theme.text,
                }}
              >
                {s.id}
              </Text>
              <View style={{ flex: 1 }}>
                <PillPicker
                  options={headingKeys}
                  value={answers[s.id] || ""}
                  onChange={(v) => onAnswer(s.id, v)}
                  usedValues={usedValues}
                  theme={theme}
                  isDark={isDark}
                />
              </View>
            </View>
            <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
              {s.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// READING_GAPPED_TEXT — passage z lukami X.Y. _____ + dopasuj fragmenty A-E
// ─────────────────────────────────────────────────────────────────────────────

function ReadingGappedText({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  // Fragmenty: różne shape backendu
  const rawFragments =
    content.fragments ||
    content.sentences ||
    content.options ||
    [];
  const fragmentMap: Record<string, string> = {};
  if (Array.isArray(rawFragments)) {
    for (const f of rawFragments) {
      if (f && typeof f === "object" && f.id) {
        fragmentMap[f.id] =
          typeof f.text === "string" ? f.text : String(f.text ?? "");
      }
    }
  } else if (rawFragments && typeof rawFragments === "object") {
    for (const [k, v] of Object.entries(rawFragments)) {
      fragmentMap[k] =
        typeof v === "string" ? v : (v as any)?.text ?? String(v ?? "");
    }
  }
  const fragmentKeys = Object.keys(fragmentMap).sort();

  // Wyciągnij gap IDs z passage (markery X.Y. ___ lub X. ___)
  const passage: string = content.passage || content.textWithGaps || "";
  const gapRegex = /(\d+(?:\.\d+)?)\.\s*_{3,}/g;
  const gapIds: string[] = [];
  let gm: RegExpExecArray | null;
  while ((gm = gapRegex.exec(passage))) {
    if (!gapIds.includes(gm[1])) gapIds.push(gm[1]);
  }

  const usedValues = useMemo(() => {
    const used = new Set<string>();
    gapIds.forEach((id) => {
      const v = answers[id];
      if (v) used.add(v);
    });
    return used;
  }, [gapIds, answers]);

  // Render passage z inline dropdowns
  const renderPassage = () => {
    if (!gapIds.length) {
      return (
        <Text style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}>
          {passage}
        </Text>
      );
    }
    const lines = passage.split("\n");
    return lines.map((line, li) => {
      const parts = line.split(/(\d+(?:\.\d+)?\.\s*_{3,})/);
      return (
        <View
          key={li}
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          {parts.map((part, i) => {
            const m = part.match(/^(\d+(?:\.\d+)?)\.\s*_{3,}$/);
            if (m) {
              const gid = m[1];
              const cur = answers[gid] || "";
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginVertical: 4,
                    marginHorizontal: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: isDark ? "#60a5fa" : "#2563eb",
                    }}
                  >
                    {gid}.
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: cur ? colors.brand[500] : theme.border,
                      backgroundColor: cur
                        ? colors.brand[500] + "20"
                        : theme.inputBg,
                      minWidth: 40,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: cur ? colors.brand[600] : theme.textTertiary,
                      }}
                    >
                      {cur || "?"}
                    </Text>
                  </View>
                </View>
              );
            }
            if (!part) return null;
            return (
              <Text
                key={i}
                style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}
              >
                {part}
              </Text>
            );
          })}
        </View>
      );
    });
  };

  return (
    <View>
      {/* Lista fragmentów A-E */}
      <View
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: isDark ? "#1e3a8a20" : "#eff6ff",
          borderWidth: 1,
          borderColor: isDark ? "#1e40af40" : "#bfdbfe",
          marginBottom: 14,
          gap: 8,
        }}
      >
        {fragmentKeys.map((k) => (
          <View key={k} style={{ flexDirection: "row", gap: 8 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: isDark ? "#60a5fa" : "#1d4ed8",
                minWidth: 22,
              }}
            >
              {k}.
            </Text>
            <Text
              style={{ fontSize: 13, color: theme.text, flex: 1, lineHeight: 19 }}
            >
              {fragmentMap[k]}
            </Text>
          </View>
        ))}
      </View>

      {/* Passage z dropdownami */}
      <View
        style={{
          padding: 14,
          borderRadius: 14,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.borderLight,
          marginBottom: 14,
        }}
      >
        {renderPassage()}
      </View>

      {/* Sekcja wyboru per luka */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color: theme.textTertiary,
          marginBottom: 8,
          letterSpacing: 0.5,
        }}
      >
        DOPASUJ FRAGMENT DO KAŻDEJ LUKI:
      </Text>
      <View style={{ gap: 10 }}>
        {gapIds.map((gid) => (
          <View
            key={gid}
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: theme.inputBg,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: theme.text,
                marginBottom: 6,
              }}
            >
              Luka {gid}
            </Text>
            <PillPicker
              options={fragmentKeys}
              value={answers[gid] || ""}
              onChange={(v) => onAnswer(gid, v)}
              usedValues={usedValues}
              theme={theme}
              isDark={isDark}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI_DIALOGUES — MCQ A/B/C dla mini-dialogu z luką
// ─────────────────────────────────────────────────────────────────────────────

function MiniDialogues({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const dialogues = content.dialogues || [];

  return (
    <View style={{ gap: 16 }}>
      {dialogues.map((d: any) => {
        const lines = Array.isArray(d.lines) ? d.lines : null;
        const contextStr = typeof d.context === "string" ? d.context : "";
        return (
          <View
            key={d.id}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "800",
                color: theme.text,
                marginBottom: 8,
              }}
            >
              {d.id}.
            </Text>

            {lines && (
              <View style={{ gap: 4, marginBottom: 12 }}>
                {lines.map((line: any, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: theme.text,
                        minWidth: 22,
                      }}
                    >
                      {line.speaker}:
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: line.text === "_____" ? colors.brand[600] : theme.text,
                        flex: 1,
                        fontWeight: line.text === "_____" ? "700" : "400",
                      }}
                    >
                      {line.text === "_____"
                        ? "_____ (wybierz poniżej)"
                        : line.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!lines && contextStr && (
              <View
                style={{
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: theme.inputBg,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
                  {contextStr.replace(/_{3,}/g, "_____ (wybierz poniżej)")}
                </Text>
              </View>
            )}

            <View style={{ gap: 8 }}>
              {normalizeOptions(d.options).map(([key, val]) => (
                <MCQOption
                  key={key}
                  label={key}
                  text={val}
                  selected={answers[d.id] === key}
                  onPress={() =>
                    onAnswer(d.id, answers[d.id] === key ? "" : key)
                  }
                  theme={theme}
                  isDark={isDark}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTH_SENTENCES — wpisz wyraz pasujący do obu zdań (lub luka w jednym zdaniu)
// ─────────────────────────────────────────────────────────────────────────────

function BothSentences({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const items = Array.isArray(content.items) ? content.items : [];
  const sentences = Array.isArray(content.sentences) ? content.sentences : [];

  if (sentences.length > 0) {
    return (
      <View>
        <Text
          style={{
            fontSize: 12,
            fontStyle: "italic",
            color: theme.textSecondary,
            marginBottom: 12,
          }}
        >
          Uzupełnij każdą lukę jednym wyrazem.
        </Text>
        <View style={{ gap: 12 }}>
          {sentences.map((s: any) => {
            const parts = String(s.text || "").split(/_{3,}/);
            return (
              <View
                key={s.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: theme.text,
                      minWidth: 36,
                      paddingTop: 4,
                    }}
                  >
                    {s.id}.
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {parts.map((p: string, i: number) => (
                      <React.Fragment key={i}>
                        <Text style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}>
                          {p}
                        </Text>
                        {i < parts.length - 1 && (
                          <TextInput
                            value={answers[s.id] || ""}
                            onChangeText={(t) => onAnswer(s.id, t)}
                            placeholder="…"
                            placeholderTextColor={theme.textTertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={{
                              minWidth: 100,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderBottomWidth: 2,
                              borderBottomColor: colors.brand[500],
                              fontSize: 13,
                              color: theme.text,
                              fontWeight: "600",
                              marginHorizontal: 4,
                            }}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // items shape — MCQ A/B/C
  return (
    <View style={{ gap: 16 }}>
      {items.map((item: any) => (
        <View
          key={item.id}
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: theme.text,
              marginBottom: 8,
            }}
          >
            {item.id}.
          </Text>
          <View style={{ gap: 4, marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: theme.text }}>
              • {String(item.sentence1 || "").replace(/_{3,}/g, "______")}
            </Text>
            <Text style={{ fontSize: 13, color: theme.text }}>
              • {String(item.sentence2 || "").replace(/_{3,}/g, "______")}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {normalizeOptions(item.options).map(([key, val]) => (
              <MCQOption
                key={key}
                label={key}
                text={val}
                selected={answers[item.id] === key}
                onPress={() =>
                  onAnswer(item.id, answers[item.id] === key ? "" : key)
                }
                theme={theme}
                isDark={isDark}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN_CLOZE — wpisz po jednym wyrazie (passage z markerami {{id}})
// ─────────────────────────────────────────────────────────────────────────────

function OpenCloze({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const items = Array.isArray(content.items) ? content.items : [];
  const passage = typeof content.passage === "string" ? content.passage : "";
  const blanks = Array.isArray(content.blanks) ? content.blanks : [];

  if (passage && blanks.length > 0) {
    const blankIds: string[] = blanks.map((b: any) => String(b.id));
    // Obsługujemy 2 typy markerów:
    // 1) {{id}} / {id}  (legacy)
    // 2) "10.1. _____"  (aktualny generator)
    const SPLIT_RE = /(\{\{[^{}]+\}\}|\{[^{}]+\}|\d+(?:\.\d+)?\.\s*_{3,})/g;
    return (
      <View>
        <Text
          style={{
            fontSize: 12,
            fontStyle: "italic",
            color: theme.textSecondary,
            marginBottom: 12,
          }}
        >
          Wymagana jest pełna poprawność gramatyczna i ortograficzna.
        </Text>
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: theme.inputBg,
            marginBottom: 12,
          }}
        >
          {passage.split("\n").map((line: string, li: number) => {
            const chunks = line.split(SPLIT_RE);
            return (
              <View
                key={li}
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                {chunks.map((chunk: string, i: number) => {
                  // {{id}} lub {id}
                  const mCurly = chunk.match(/^\{\{?([^{}]+)\}?\}$/);
                  // "10.1. _____"
                  const mDotted = chunk.match(/^(\d+(?:\.\d+)?)\.\s*_{3,}$/);
                  if (!mCurly && !mDotted) {
                    if (!chunk) return null;
                    return (
                      <Text
                        key={i}
                        style={{ fontSize: 13, color: theme.text, lineHeight: 22 }}
                      >
                        {chunk}
                      </Text>
                    );
                  }
                  const raw = (mCurly ? mCurly[1] : mDotted![1]).trim();
                  const blankId =
                    blankIds.find((id) => id === raw || id.endsWith(raw)) || raw;
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginHorizontal: 2,
                        marginVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: colors.brand[600],
                          marginRight: 2,
                        }}
                      >
                        {blankId}.
                      </Text>
                      <TextInput
                        value={answers[blankId] || ""}
                        onChangeText={(t) => onAnswer(blankId, t)}
                        placeholder="…"
                        placeholderTextColor={theme.textTertiary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={{
                          minWidth: 90,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderBottomWidth: 2,
                          borderBottomColor: colors.brand[500],
                          fontSize: 13,
                          color: theme.text,
                          fontWeight: "600",
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // items shape
  return (
    <View>
      <Text
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: theme.textSecondary,
          marginBottom: 12,
        }}
      >
        Wymagana jest pełna poprawność gramatyczna i ortograficzna.
      </Text>
      <View style={{ gap: 14 }}>
        {items.map((it: any) => (
          <View
            key={it.id}
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: theme.text, minWidth: 36 }}>
                {it.id}
              </Text>
              <TextInput
                value={answers[it.id] || ""}
                onChangeText={(t) => onAnswer(it.id, t)}
                placeholder="Wpisz wyraz"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 14,
                  color: theme.text,
                }}
              />
            </View>
            <View style={{ gap: 4 }}>
              {(it.sentences || []).map((s: string, i: number) => (
                <Text key={i} style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
                  • {s.replace(/_{3,}/g, "______")}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMATION — przekształć zdanie/przetłumacz
// ─────────────────────────────────────────────────────────────────────────────

function Transformation({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const rows = (Array.isArray(content.items) ? content.items : []).concat(
    Array.isArray(content.sentences) ? content.sentences : [],
  );

  return (
    <View>
      <Text
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: theme.textSecondary,
          marginBottom: 12,
        }}
      >
        Wymagana jest pełna poprawność gramatyczna i ortograficzna.
      </Text>
      <View style={{ gap: 14 }}>
        {rows.map((row: any) => {
          const promptStr = row.prompt ?? row.original ?? "";
          const hintWord = row.givenWords ?? row.hint ?? "";
          return (
            <View
              key={row.id}
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                {row.id}.
              </Text>
              {promptStr ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.text,
                    lineHeight: 20,
                    marginBottom: 6,
                  }}
                >
                  {String(promptStr).replace(/_+/g, "______")}
                </Text>
              ) : null}
              {hintWord ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.brand[600],
                    fontWeight: "700",
                    marginBottom: 8,
                  }}
                >
                  ({hintWord})
                </Text>
              ) : null}
              <TextInput
                value={answers[row.id] || ""}
                onChangeText={(t) => onAnswer(row.id, t)}
                placeholder="Wpisz odpowiedź"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={{
                  backgroundColor: theme.inputBg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 14,
                  color: theme.text,
                  minHeight: 44,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITING — wypowiedź pisemna z wyborem tematu
// ─────────────────────────────────────────────────────────────────────────────

function Writing({ task, answers, onAnswer, theme, isDark }: RenderProps) {
  const content = task.content;
  const qId = "writing";
  const topicChoiceId = "writing_topic";
  const text = answers[qId] || "";
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minWords = content.wordCount?.min || 100;
  const maxWords = content.wordCount?.max || 200;

  const topics: any[] = Array.isArray(content.topics) ? content.topics : [];
  const hasTopicChoice = topics.length > 0;
  const selectedTopicId = answers[topicChoiceId];
  const selectedTopic = hasTopicChoice
    ? topics.find((t) => String(t.id) === String(selectedTopicId)) || null
    : null;
  const brief: any = selectedTopic || content;

  return (
    <View>
      {hasTopicChoice && (
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              // textTertiary to w ciemnym motywie zinc[500] — na ciemnym tle
              // ten 10-punktowy nagłówek był praktycznie nieczytelny.
              color: isDark ? theme.textSecondary : theme.textTertiary,
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            WYBIERZ JEDEN TEMAT:
          </Text>
          <View style={{ gap: 8 }}>
            {topics.map((t: any) => {
              const tid = String(t.id);
              const sel = String(selectedTopicId || "") === tid;
              return (
                <TouchableOpacity
                  key={tid}
                  onPress={() => onAnswer(topicChoiceId, tid)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: sel ? colors.brand[500] : theme.border,
                    backgroundColor: sel ? colors.brand[500] + "15" : theme.inputBg,
                    flexDirection: "row",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: sel ? colors.brand[500] : theme.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>
                      {tid}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: theme.text,
                      }}
                    >
                      {t.title ||
                        (typeof t.promptPL === "string"
                          ? t.promptPL.length > 90
                            ? t.promptPL.slice(0, 90).trimEnd() + "…"
                            : t.promptPL
                          : "")}
                    </Text>
                    {t.form && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: theme.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        forma: {t.form}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {hasTopicChoice && !selectedTopic && (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? "#78350f15" : "#fffbeb",
            borderWidth: 1,
            borderColor: isDark ? "#92400e40" : "#fde68a",
          }}
        >
          <Text style={{ fontSize: 13, color: isDark ? "#fbbf24" : "#92400e" }}>
            Wybierz temat powyżej, by zobaczyć szczegóły i napisać wypowiedź.
          </Text>
        </View>
      )}

      {(!hasTopicChoice || selectedTopic) && (
        <>
          {brief.scenario && (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: isDark ? "#78350f15" : "#fffbeb",
                borderWidth: 1,
                borderColor: isDark ? "#92400e40" : "#fde68a",
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
                {brief.scenario}
              </Text>
            </View>
          )}

          {(brief.bulletPoints || brief.form || brief.recipient) && (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.borderLight,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                W {brief.form || "e-mailu"} do {brief.recipient || "kolegi/koleżanki"}:
              </Text>
              <View style={{ gap: 4 }}>
                {(brief.bulletPoints || []).map((bp: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.brand[500] }}>•</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.text,
                        flex: 1,
                        lineHeight: 19,
                      }}
                    >
                      {bp}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.textSecondary,
                  marginTop: 8,
                }}
              >
                Długość: {minWords}–{maxWords} wyrazów. Podpisz się jako{" "}
                {brief.signOff || "XYZ"}.
              </Text>
            </View>
          )}

          <TextInput
            value={text}
            onChangeText={(t) => onAnswer(qId, t)}
            placeholder="Napisz swoją wypowiedź..."
            placeholderTextColor={theme.textTertiary}
            multiline
            style={{
              backgroundColor: theme.inputBg,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: theme.text,
              minHeight: 220,
              textAlignVertical: "top",
            }}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color:
                  wordCount < minWords
                    ? "#f59e0b"
                    : wordCount > maxWords
                      ? "#ef4444"
                      : "#10b981",
                fontVariant: ["tabular-nums"],
              }}
            >
              {wordCount} / {minWords}–{maxWords} wyrazów
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export function GermanTaskRenderer(props: RenderProps) {
  const t = normalizeLangType(props.task.type);

  // Listening (audio)
  if (t === "listening_matching") return <ListeningMatchingDe {...props} />;
  if (t === "listening_mcq" || t === "listening_mcq_pr")
    return <ListeningMcqDe {...props} />;
  if (t === "listening_fill") return <ListeningFillDe {...props} />;

  // Reading
  if (t === "reading_mcq" || t === "reading_two_texts" || t === "reading_mixed")
    return <ReadingMcq {...props} />;
  if (
    t === "reading_heading_match" ||
    t === "reading_paragraph_match"
  )
    return <ReadingHeadingMatch {...props} />;
  if (t === "reading_gapped_text" || t === "reading_gapped_text_pr")
    return <ReadingGappedText {...props} />;

  // Use of language
  if (t === "mini_dialogues") return <MiniDialogues {...props} />;
  if (t === "both_sentences") return <BothSentences {...props} />;
  if (t === "open_cloze" || t === "mcq_cloze" || t === "word_formation")
    return <OpenCloze {...props} />;
  if (
    t === "transformation" ||
    t === "sentence_completion_pr" ||
    t === "sentence_transform_pr" ||
    t === "word_three_sentences"
  )
    return <Transformation {...props} />;

  // Writing
  if (t === "writing" || t === "writing_pr") return <Writing {...props} />;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#fef2f2",
        borderWidth: 1,
        borderColor: "#fecaca",
      }}
    >
      <Text style={{ fontSize: 13, color: "#b91c1c", fontWeight: "600" }}>
        Typ zadania „{props.task.type}" jeszcze nie ma renderera mobilnego.
      </Text>
    </View>
  );
}
