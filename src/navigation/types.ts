// ============================================================================
// Navigation — Type definitions
// ============================================================================

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
  ExamTab: undefined;
};

// ── Nested Stacks ─────────────────────────────────────────────────────────
export type HomeStackParamList = {
  Dashboard: undefined;
  SessionHistory: undefined;
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
    subjectId: string; // ← NEW: needed for live filters
    questionTypes?: string[]; // ← NEW: initial category types from setup
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
  Badges: undefined;
  Ranking: undefined;
  AiCreditsHistory: undefined;
};

// ── Root ──────────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// ── Exam Stack ────────────────────────────────────────────────────────────
export type ExamStackParamList = {
  ExamSelector: undefined;
  ExamPlay: { examId: string; subjectId: string };
  ExamResults: { attemptId: string };
  ExamHistory: undefined;
};
