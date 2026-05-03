// src/components/common/GamificationToasts.tsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";

// ── Types ──────────────────────────────────────────────────────────────────

interface GamificationEvent {
  type: "badge" | "level_up" | "title" | "streak";
  icon: string;
  title: string;
  subtitle: string;
  tier?: string;
  color?: string;
  xp?: number;
}

// ── Global event bus ───────────────────────────────────────────────────────

type Listener = (event: GamificationEvent) => void;
const listeners = new Set<Listener>();

export function emitGamificationEvent(event: GamificationEvent) {
  listeners.forEach((fn) => fn(event));
}

// ── Process answer submit response ─────────────────────────────────────────

const TITLE_THRESHOLDS = [
  { level: 1, name: "Maturalny Bot", emoji: "🤖", color: "#94a3b8" },
  { level: 2, name: "Bambik", emoji: "🦌", color: "#60a5fa" },
  { level: 4, name: "Kujon", emoji: "🤓", color: "#a78bfa" },
  { level: 7, name: "Maszyna", emoji: "⚙️", color: "#f59e0b" },
  { level: 10, name: "GOAT", emoji: "🐐", color: "#ef4444" },
];

let previousGlobalLevel = 0;

export function processGamificationResponse(gamification: {
  totalXp: number;
  globalLevel: number;
  subjectLevel: number;
  leveledUp: boolean;
  streak: number;
  isNewDay: boolean;
  achievements: {
    slug: string;
    name: string;
    icon: string;
    xpReward: number;
  }[];
}) {
  if (!gamification) return;

  for (const badge of gamification.achievements || []) {
    emitGamificationEvent({
      type: "badge",
      icon: badge.icon,
      title: badge.name,
      subtitle: `Nowa odznaka! +${badge.xpReward} XP`,
      xp: badge.xpReward,
    });
  }

  if (gamification.leveledUp) {
    emitGamificationEvent({
      type: "level_up",
      icon: "⬆️",
      title: `Poziom ${gamification.subjectLevel}!`,
      subtitle: "Nowy poziom w przedmiocie",
    });
  }

  if (
    previousGlobalLevel > 0 &&
    previousGlobalLevel !== gamification.globalLevel
  ) {
    const oldTitle = TITLE_THRESHOLDS.filter(
      (t) => previousGlobalLevel >= t.level,
    ).pop();
    const newTitle = TITLE_THRESHOLDS.filter(
      (t) => gamification.globalLevel >= t.level,
    ).pop();
    if (newTitle && oldTitle && newTitle.name !== oldTitle.name) {
      emitGamificationEvent({
        type: "title",
        icon: newTitle.emoji,
        title: newTitle.name,
        subtitle: `Nowy tytuł! Jesteś teraz ${newTitle.name}`,
        color: newTitle.color,
      });
    }
  }
  previousGlobalLevel = gamification.globalLevel;

  if (
    gamification.isNewDay &&
    [3, 7, 14, 30, 50, 100].includes(gamification.streak)
  ) {
    emitGamificationEvent({
      type: "streak",
      icon: "🔥",
      title: `Seria ${gamification.streak} dni!`,
      subtitle: "Nie zatrzymuj się!",
    });
  }
}

// ── Accent colors ──────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  badge: "#6366f1",
  level_up: "#22c55e",
  title: "#f59e0b",
  streak: "#ef4444",
};

// ── Toast Component ────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function GamificationToasts() {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<(GamificationEvent & { id: number })[]>(
    [],
  );
  const [visible, setVisible] = useState<
    (GamificationEvent & { id: number }) | null
  >(null);

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const addToast = useCallback((event: GamificationEvent) => {
    setQueue((prev) => [...prev, { ...event, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  useEffect(() => {
    if (visible || queue.length === 0) return;
    const next = queue[0];
    setQueue((prev) => prev.slice(1));
    setVisible(next);

    // Animate in
    translateY.setValue(-60);
    opacity.setValue(0);
    scale.setValue(0.9);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 15,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(null));
    }, 3500);

    return () => clearTimeout(timer);
  }, [visible, queue]);

  if (!visible) return null;

  const accentColor = visible.color || TYPE_COLORS[visible.type] || "#6366f1";

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -80,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => setVisible(null));
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingLeft: 14,
          paddingRight: 16,
          paddingVertical: 12,
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.97)",
          borderWidth: 1,
          borderColor: accentColor + "40",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 24,
          elevation: 12,
        }}
      >
        {/* Accent bar */}
        <View
          style={{
            width: 4,
            height: 36,
            borderRadius: 2,
            backgroundColor: accentColor,
          }}
        />

        {/* Icon */}
        <Text style={{ fontSize: 28 }}>{visible.icon}</Text>

        {/* Text */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontWeight: "700",
              fontSize: 14,
              color: "#18181b",
            }}
            numberOfLines={1}
          >
            {visible.title}
          </Text>
          <Text style={{ fontSize: 12, color: "#71717a" }} numberOfLines={1}>
            {visible.subtitle}
          </Text>
        </View>

        {/* XP pill */}
        {visible.xp && visible.xp > 0 && (
          <View
            style={{
              backgroundColor: colors.brand[100],
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 99,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: colors.brand[700],
              }}
            >
              +{visible.xp}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
