// ============================================================================
// Navigation — Type definitions
// ============================================================================

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ── Auth Stack ────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Verify: { email: string };
  ForgotPassword: undefined;
};

// ── Main Tabs ─────────────────────────────────────────────────────────────
export type MainTabParamList = {
  HomeTab: undefined;
  SubjectsTab: undefined;
  QuizTab: undefined;
  ProfileTab: undefined;
};

// ── Nested Stacks ─────────────────────────────────────────────────────────
export type HomeStackParamList = {
  Dashboard: undefined;
};

export type SubjectsStackParamList = {
  SubjectsList: undefined;
  SubjectDetail: { slug: string; name: string };
};

export type QuizStackParamList = {
  QuizSetup: { subjectId?: string; topicId?: string } | undefined;
  QuizPlay: {
    sessionId: string;
    questions: any[];
    subjectName: string;
  };
  QuizResult: {
    sessionId: string;
    questionsAnswered: number;
    correctAnswers: number;
    accuracy: number;
    xpEarned: number;
    totalTimeMs: number;
  };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
};

// ── Root ──────────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
