// ============================================================================
// useListeningPlayer — wspólna logika odtwarzacza nagrań listening (expo-audio)
//
// Migracja z expo-av (deprecated, usuwane w SDK 55): expo-av na Androidzie
// potrafiło załadować dźwięk, ale cicho nie rozpocząć odtwarzania (połknięty
// AudioFocusNotAcquiredException) — licznik odsłuchań się zużywał bez dźwięku.
// Tutaj odsłuch liczy się dopiero, gdy playback faktycznie ruszył.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";

interface Options {
  src: string | null;
  maxPlays: number;
  initialDurationMs?: number | null;
  disabled?: boolean;
}

export function useListeningPlayer({
  src,
  maxPlays,
  initialDurationMs,
  disabled = false,
}: Options) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove(): void } | null>(null);
  // Czy bieżący odsłuch został policzony (playback realnie wystartował)
  const countedRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchroniczna blokada re-entrancy: stan Reacta (loading/loaded) jest
  // nieświeży przy szybkich wielokrotnych tapnięciach i pozwalał stworzyć
  // dwa playery naraz (nakładające się głosy)
  const busyRef = useRef(false);

  const [playCount, setPlayCount] = useState(0);
  const [loaded, setLoaded] = useState(false); // odsłuch w toku (player istnieje)
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(initialDurationMs || 0);

  const destroyPlayer = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    subRef.current?.remove();
    subRef.current = null;
    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try {
        p.remove();
      } catch {}
    }
    setLoaded(false);
    setIsPlaying(false);
  }, []);

  // Cleanup przy odmontowaniu
  useEffect(() => destroyPlayer, [destroyPlayer]);

  const canStart = playCount < maxPlays && !disabled && !!src;

  const armWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      const p = playerRef.current;
      if (!p || countedRef.current) return;
      if (p.isBuffering) {
        // wolna sieć — dajemy kolejne okno zamiast zgłaszać błąd
        armWatchdog();
        return;
      }
      destroyPlayer();
      setError(
        "Nie udało się uruchomić odtwarzania. Sprawdź głośność multimediów i spróbuj ponownie.",
      );
    }, 8000);
  }, [destroyPlayer]);

  const handlePlay = useCallback(async () => {
    if (disabled || busyRef.current) return;

    // Pauza / wznowienie w ramach bieżącego odsłuchu — decyduje ref
    // (synchroniczna prawda), nie stan `loaded` z ostatniego renderu
    const existing = playerRef.current;
    if (existing) {
      try {
        if (existing.playing) existing.pause();
        else existing.play();
      } catch {}
      return;
    }

    if (!canStart || !src) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      destroyPlayer();
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "duckOthers",
      }).catch(() => {});

      const player = createAudioPlayer({ uri: src }, { updateInterval: 400 });
      playerRef.current = player;
      countedRef.current = false;

      subRef.current = player.addListener(
        "playbackStatusUpdate",
        (st: AudioStatus) => {
          if (playerRef.current !== player) return;
          if (st.duration > 0) setDurationMs(Math.round(st.duration * 1000));
          setPositionMs(Math.round(st.currentTime * 1000));
          setIsPlaying(st.playing);
          if (st.playing && !countedRef.current) {
            // Odsłuch zużywa limit dopiero, gdy dźwięk faktycznie ruszył
            countedRef.current = true;
            if (watchdogRef.current) {
              clearTimeout(watchdogRef.current);
              watchdogRef.current = null;
            }
            setPlayCount((c) => c + 1);
          }
          if (st.didJustFinish) {
            setPositionMs(
              st.duration > 0 ? Math.round(st.duration * 1000) : 0,
            );
            destroyPlayer();
          }
        },
      );

      player.play();
      setLoaded(true);
      armWatchdog();
    } catch (err) {
      destroyPlayer();
      setError("Nie udało się odtworzyć nagrania. Spróbuj ponownie.");
      console.error("Audio play error:", err);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [canStart, src, disabled, destroyPlayer, armWatchdog]);

  const handleStop = useCallback(() => {
    if (!playerRef.current || !loaded) return;
    destroyPlayer();
    setPositionMs(0);
  }, [loaded, destroyPlayer]);

  // frac ∈ [0, 1] — pozycja dotknięcia na pasku
  const seekToFraction = useCallback(
    (frac: number) => {
      const p = playerRef.current;
      if (!p || !loaded || durationMs <= 0 || disabled) return;
      const f = Math.min(1, Math.max(0, frac));
      try {
        void p.seekTo((f * durationMs) / 1000);
      } catch {}
    },
    [loaded, durationMs, disabled],
  );

  return {
    playCount,
    playsLeft: Math.max(0, maxPlays - playCount),
    canStart,
    loaded,
    isPlaying,
    loading,
    error,
    positionMs,
    durationMs,
    progress: durationMs > 0 ? (positionMs / durationMs) * 100 : 0,
    handlePlay,
    handleStop,
    seekToFraction,
  };
}
