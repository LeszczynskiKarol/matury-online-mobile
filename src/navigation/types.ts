// ============================================================================
// Navigation — Type definitions
// ============================================================================

import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Verify: { email: string };
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  SubjectsTab: undefined;
  QuizTab: undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

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
  Subscription: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
