// ============================================================================
// Tutor zone API — /api/tutor/* (strona UCZNIA)
//
// Korepetytor prowadzi grupę na webie (/korepetytor); apka pokazuje uczniowi
// tylko to, co mu zadano. Miejsce od korepetytora daje dostęp WYŁĄCZNIE do
// jego zadań (nie do reszty Premium) — serwer sam to egzekwuje
// (sessions.ts / exam-live.ts), apka ma tylko nie zasłaniać tej ścieżki
// własną bramką Premium.
// ============================================================================

import { api } from "./client";

export type AssignmentKind = "QUIZ_SET" | "TOPIC_PRACTICE" | "EXAM";
export type TargetStatus = "PENDING" | "IN_PROGRESS" | "DONE";
export type SetStatus = "GENERATING" | "READY" | "ERROR" | null;

export interface MyTutor {
  id: string;
  displayName: string;
  seatEnd: string | null;
  hasSeat: boolean;
  joinedAt: string | null;
}

export interface MyAssignment {
  targetId: string;
  tutorName: string;
  /** false = korepetytor nie przydzielił miejsca (serwer odpowie NO_SEAT). */
  canRun: boolean;
  kind: AssignmentKind;
  title: string;
  note: string | null;
  subject: {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  examId: string | null;
  questionCount: number | null;
  /** Zestaw z AI: GENERATING = pytania jeszcze powstają. */
  setStatus: SetStatus;
  dueAt: string | null;
  createdAt: string;
  status: TargetStatus;
  scorePct: number | null;
  startedAt: string | null;
  completedAt: string | null;
  examAttemptId: string | null;
}

export interface MyAssignmentsResponse {
  /** Własny, płatny dostęp ucznia (odblokowuje całą apkę). */
  ownPremium: boolean;
  /** Żywe miejsce od korepetytora (odblokowuje tylko jego zadania). */
  seatActive: boolean;
  /** Mail „nowe zadania od korepetytora" (User.emailTutorZone). */
  emailNotify: boolean;
  tutors: MyTutor[];
  assignments: MyAssignment[];
}

export interface AssignmentTarget extends MyAssignment {
  topicId: string | null;
  session: { id: string; status: string } | null;
}

export async function getMyAssignments(): Promise<MyAssignmentsResponse> {
  return api<MyAssignmentsResponse>("/tutor/my");
}

export async function getAssignmentTarget(
  targetId: string,
): Promise<AssignmentTarget> {
  return api<AssignmentTarget>(`/tutor/my/targets/${targetId}`);
}

export const KIND_LABEL: Record<AssignmentKind, string> = {
  QUIZ_SET: "Pytania z AI",
  TOPIC_PRACTICE: "Ćwiczenie z banku",
  EXAM: "Arkusz",
};
