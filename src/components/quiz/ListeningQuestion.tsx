// ============================================================================
// ListeningQuestion — React Native component for audio-based questions
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Audio } from "expo-av";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { OptionCard } from "./OptionCard";

// ── Types ─────────────────────────────────────────────────────────────────

interface SubQuestion {
  id: string;
  text: string;
  type: "CLOSED" | "TRUE_FALSE" | "OPEN" | "FILL_IN";
  points: number;
  options?: { id: string; text: string }[];
  statements?: { text: string; isTrue: boolean }[];
  acceptedAnswers?: string[];
  correctAnswer?: string;
}

interface ListeningContent {
  listeningType: string;
  audioUrl: string | null;
  audioDurationMs: number | null;
  maxPlays: number;
  contextPL: string;
  question: string;
  subQuestions: SubQuestion[];
}

interface Props {
  content: ListeningContent;
  response: Record<string, any> | null;
  onChange: (v: Record<string, any>) => void;
  disabled: boolean;
  feedback: any;
}

// ── Main Component ────────────────────────────────────────────────────────

export function ListeningQuestion({
  content,
  response,
  onChange,
  disabled,
  feedback,
}: Props) {
  const { colors: theme } = useTheme();
  const isA = feedback !== null;

  // Normalize Claude's inconsistent output
  const normalizedSubs = (content.subQuestions || []).map(
    (sq: any, i: number) => ({
      id: String(sq.id || String.fromCharCode(97 + i)),
      text: sq.text || sq.question || "",
      type:
        sq.type ||
        (sq.options
          ? "CLOSED"
          : sq.statements
            ? "TRUE_FALSE"
            : sq.acceptedAnswers
              ? "FILL_IN"
              : "OPEN"),
      points: sq.points || 1,
      options: Array.isArray(sq.options)
        ? sq.options.map((o: any) => ({ id: o.id || o.letter, text: o.text }))
        : undefined,
      correctAnswer: sq.correctAnswer,
      statements: sq.statements,
      acceptedAnswers: sq.acceptedAnswers,
    }),
  );

  const ans = (response as Record<string, any>) || {};
  const set = (id: string, v: any) => {
    if (disabled) return;
    onChange({ ...ans, [id]: v });
  };

  return (
    <View>
      <Text
        style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}
      >
        {content.contextPL}
      </Text>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "500",
          color: theme.text,
          lineHeight: 26,
          marginBottom: 16,
        }}
      >
        {content.question}
      </Text>

      <AudioPlayer
        src={content.audioUrl}
        maxPlays={content.maxPlays}
        durationMs={content.audioDurationMs}
        disabled={disabled}
      />

      <View style={{ gap: 16, marginTop: 20 }}>
        {normalizedSubs.map((sq: any, i: number) => (
          <View
            key={sq.id}
            style={{
              backgroundColor: theme.inputBg,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#3b82f6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}
                >
                  {i + 1}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: "500",
                  color: theme.text,
                }}
              >
                {sq.text}
              </Text>
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>
                {sq.points} pkt
              </Text>
            </View>

            {/* CLOSED */}
            {sq.type === "CLOSED" && sq.options && (
              <View style={{ gap: 6 }}>
                {sq.options.map((o: any) => {
                  const userPicked = ans[sq.id] === o.id;
                  const isCorrectOpt = isA && o.id === sq.correctAnswer;
                  const isWrongPick =
                    isA && userPicked && o.id !== sq.correctAnswer;
                  return (
                    <OptionCard
                      key={o.id}
                      id={o.id}
                      text={o.text}
                      state={
                        isA
                          ? isCorrectOpt
                            ? "correct"
                            : isWrongPick
                              ? "wrong"
                              : "default"
                          : userPicked
                            ? "selected"
                            : "default"
                      }
                      onPress={() => set(sq.id, o.id)}
                      disabled={disabled}
                    />
                  );
                })}
              </View>
            )}

            {/* TRUE_FALSE */}
            {sq.type === "TRUE_FALSE" && sq.statements && (
              <View style={{ gap: 6 }}>
                {sq.statements.map((st: any, si: number) => {
                  const sa =
                    (ans[sq.id] as boolean[]) || sq.statements.map(() => null);
                  const userAnswer = sa[si];
                  const correctAnswer = st.isTrue;
                  const userRight = isA && userAnswer === correctAnswer;
                  const userWrong =
                    isA && userAnswer != null && userAnswer !== correctAnswer;
                  return (
                    <View
                      key={si}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingVertical: 6,
                        backgroundColor: isA
                          ? userRight
                            ? colors.brand[500] + "15"
                            : userWrong
                              ? colors.red[500] + "15"
                              : "transparent"
                          : "transparent",
                        borderRadius: 10,
                        paddingHorizontal: 8,
                      }}
                    >
                      <Text
                        style={{ flex: 1, fontSize: 12, color: theme.text }}
                      >
                        {st.text}
                      </Text>
                      {isA && (
                        <View
                          style={{
                            backgroundColor: correctAnswer
                              ? colors.brand[500]
                              : colors.red[500],
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 8,
                              fontWeight: "700",
                              color: "#fff",
                            }}
                          >
                            {correctAnswer ? "TRUE" : "FALSE"}
                          </Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {["T", "F"].map((label) => {
                          const val = label === "T";
                          const isThis = userAnswer === val;
                          return (
                            <TouchableOpacity
                              key={label}
                              disabled={disabled}
                              onPress={() => {
                                const n = [...sa];
                                n[si] = val;
                                set(sq.id, n);
                              }}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                backgroundColor: isThis
                                  ? isA
                                    ? val === correctAnswer
                                      ? colors.brand[500]
                                      : colors.red[500]
                                    : val
                                      ? colors.brand[500]
                                      : colors.red[500]
                                  : theme.card,
                                borderWidth: 1,
                                borderColor: theme.border,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: isThis ? "#fff" : theme.textSecondary,
                                }}
                              >
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* OPEN */}
            {sq.type === "OPEN" && (
              <TextInput
                value={ans[sq.id] || ""}
                onChangeText={(text) => set(sq.id, text)}
                editable={!disabled}
                multiline
                placeholder="Your answer..."
                placeholderTextColor={theme.textTertiary}
                style={{
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  color: theme.text,
                  minHeight: 50,
                  textAlignVertical: "top",
                }}
              />
            )}

            {/* FILL_IN */}
            {sq.type === "FILL_IN" &&
              (() => {
                const userVal = (ans[sq.id] || "").toLowerCase().trim();
                const isOk =
                  isA &&
                  sq.acceptedAnswers?.some(
                    (a: string) => a.toLowerCase().trim() === userVal,
                  );
                return (
                  <View>
                    <TextInput
                      value={ans[sq.id] || ""}
                      onChangeText={(text) => set(sq.id, text)}
                      editable={!disabled}
                      placeholder="Type your answer..."
                      placeholderTextColor={theme.textTertiary}
                      style={{
                        backgroundColor: theme.card,
                        borderWidth: 1,
                        borderColor: isA
                          ? isOk
                            ? colors.brand[500]
                            : colors.red[500]
                          : theme.border,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: theme.text,
                      }}
                    />
                    {isA && !isOk && sq.acceptedAnswers?.length > 0 && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.brand[600],
                          marginTop: 4,
                        }}
                      >
                        Poprawna: {sq.acceptedAnswers[0]}
                        {sq.acceptedAnswers.length > 1
                          ? ` (lub: ${sq.acceptedAnswers.slice(1).join(", ")})`
                          : ""}
                      </Text>
                    )}
                  </View>
                );
              })()}
          </View>
        ))}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// AUDIO PLAYER (expo-av)
// ══════════════════════════════════════════════════════════════════════════

function AudioPlayer({
  src,
  maxPlays,
  durationMs,
  disabled,
}: {
  src: string | null;
  maxPlays: number;
  durationMs: number | null;
  disabled: boolean;
}) {
  const { colors: theme, isDark } = useTheme();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);
  const [loading, setLoading] = useState(false);

  const canPlay = playCount < maxPlays && !disabled;
  const playsLeft = maxPlays - playCount;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handlePlay = useCallback(async () => {
    if (!canPlay || !src || loading) return;
    setLoading(true);
    try {
      // Unload previous if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

      const { sound } = await Audio.Sound.createAsync(
        { uri: src },
        { shouldPlay: true, positionMillis: 0 },
        (status) => {
          if (!status.isLoaded) return;
          setCurrentTime(status.positionMillis / 1000);
          setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          setProgress(
            status.durationMillis
              ? (status.positionMillis / status.durationMillis) * 100
              : 0,
          );
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setProgress(100);
          }
        },
      );
      soundRef.current = sound;
      setPlayCount((c) => c + 1);
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio play error:", err);
    } finally {
      setLoading(false);
    }
  }, [canPlay, src, loading]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!src) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: 16,
          backgroundColor: "#fffbeb",
          borderWidth: 1,
          borderColor: "#fde68a",
        }}
      >
        <Text style={{ fontSize: 16 }}>⚠️</Text>
        <Text style={{ fontSize: 13, color: "#92400e", flex: 1 }}>
          Audio jest generowane. Spróbuj za chwilę.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: isDark ? "#1a1a2e" : "#f8fafc",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: isDark ? "#27272a" : "#e2e8f0",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {/* Play button */}
        <TouchableOpacity
          onPress={handlePlay}
          disabled={!canPlay || isPlaying || loading}
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              canPlay && !isPlaying
                ? "#4f46e5"
                : isPlaying
                  ? "#4f46e5" + "33"
                  : isDark
                    ? "#27272a"
                    : "#e2e8f0",
            shadowColor: canPlay ? "#4f46e5" : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: canPlay ? 4 : 0,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isPlaying ? (
            <View style={{ flexDirection: "row", gap: 3 }}>
              <View
                style={{
                  width: 4,
                  height: 16,
                  borderRadius: 2,
                  backgroundColor: "#4f46e5",
                }}
              />
              <View
                style={{
                  width: 4,
                  height: 16,
                  borderRadius: 2,
                  backgroundColor: "#4f46e5",
                }}
              />
            </View>
          ) : (
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 14,
                borderTopWidth: 9,
                borderBottomWidth: 9,
                borderLeftColor: canPlay
                  ? "#fff"
                  : isDark
                    ? "#71717a"
                    : "#a1a1aa",
                borderTopColor: "transparent",
                borderBottomColor: "transparent",
                marginLeft: 3,
              }}
            />
          )}
        </TouchableOpacity>

        {/* Waveform + time */}
        <View style={{ flex: 1 }}>
          {/* Waveform bars */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              height: 36,
              gap: 1.5,
              marginBottom: 6,
            }}
          >
            {Array.from({ length: 40 }).map((_, i) => {
              const h = 20 + Math.sin(i * 0.7) * 15 + Math.cos(i * 1.3) * 10;
              const filled = (i / 40) * 100 <= progress;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.max(12, h)}%`,
                    borderRadius: 2,
                    backgroundColor: filled
                      ? "#3b82f6"
                      : isDark
                        ? "#27272a"
                        : "#e2e8f0",
                  }}
                />
              );
            })}
          </View>

          {/* Time + plays */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: theme.textTertiary,
                fontFamily: "JetBrainsMono_400Regular",
              }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              {Array.from({ length: maxPlays }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor:
                      i < playCount
                        ? "#3b82f6"
                        : isDark
                          ? "#3f3f46"
                          : "#d4d4d8",
                  }}
                />
              ))}
              <Text
                style={{
                  fontSize: 9,
                  color: theme.textTertiary,
                  marginLeft: 4,
                }}
              >
                {playsLeft > 0
                  ? `${playsLeft} odsłuch${playsLeft > 1 ? "ania" : "anie"}`
                  : "Limit odsłuchań"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Warnings */}
      {playCount === maxPlays - 1 && !isPlaying && playCount > 0 && (
        <View
          style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 10,
            backgroundColor: "#fffbeb",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: "#92400e",
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            ⚠ Ostatnie odsłuchanie. Słuchaj uważnie!
          </Text>
        </View>
      )}
      {playCount >= maxPlays && !isPlaying && (
        <View
          style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 10,
            backgroundColor: isDark ? "#27272a" : "#f4f4f5",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: theme.textTertiary,
              textAlign: "center",
            }}
          >
            Nagranie zakończone. Odpowiedz na pytania poniżej.
          </Text>
        </View>
      )}
    </View>
  );
}
