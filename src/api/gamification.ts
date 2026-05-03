// ============================================================================
// Gamification API — badges, labels, titles, showcase
// ============================================================================

import { api } from "./client";

export interface BadgeData {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  xpReward: number;
  unlockedAt?: string;
  progress?: { current: number; target: number };
}

export interface BadgesResponse {
  earned: BadgeData[];
  locked: BadgeData[];
  stats: {
    total: number;
    earned: number;
    byTier: Record<string, number>;
  };
}

export interface Label {
  id: string;
  text: string;
  color: string;
  category: string;
  isActive?: boolean;
}

export interface LabelsResponse {
  active: Label[];
  all: (Label & { isActive: boolean })[];
}

export interface TitleInfo {
  name: string;
  minLevel: number;
  color: string;
  emoji: string;
}

export interface TitleResponse {
  current: TitleInfo;
  next: { next: TitleInfo; progress: number } | null;
  globalLevel: number;
  totalXp: number;
  allTitles: (TitleInfo & { reached: boolean; isCurrent: boolean })[];
}

export interface ProfileResponse {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  totalXp: number;
  globalLevel: number;
  currentStreak: number;
  longestStreak: number;
  title: TitleInfo;
  labels: Label[];
  showcaseBadges: {
    id: string;
    slug: string;
    name: string;
    icon: string;
    tier: string;
  }[];
  showcaseBadgeIds: string[];
}

export const getBadges = () => api<BadgesResponse>("/gamification/badges");

export const getLabels = () => api<LabelsResponse>("/gamification/labels");

export const getTitle = () => api<TitleResponse>("/gamification/title");

export const getProfile = () => api<ProfileResponse>("/gamification/profile");

export const setShowcase = (badgeIds: string[]) =>
  api<{ ok: boolean; showcaseBadgeIds: string[] }>("/gamification/showcase", {
    method: "POST",
    body: { badgeIds },
  });

export const getLevel = () => api<any>("/gamification/level");

export const getStreak = () => api<any>("/gamification/streak");

export const getLeaderboard = (subjectId?: string) =>
  api<{ leaders: any[]; currentUserEntry: any; type: string }>(
    `/gamification/leaderboard${subjectId ? `?subjectId=${subjectId}` : ""}`,
  );

export const getLeaderboardVisibility = () =>
  api<{ hideFromLeaderboard: boolean }>("/gamification/leaderboard/visibility");

export const toggleLeaderboardVisibility = () =>
  api<{ hideFromLeaderboard: boolean }>(
    "/gamification/leaderboard/toggle-visibility",
    {
      method: "POST",
    },
  );
