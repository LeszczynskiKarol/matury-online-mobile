// ============================================================================
// Subjects API — /api/subjects/*
// ============================================================================

import { api } from "./client";

export interface Subject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
  // `exams` — gotowe arkusze przedmiotu (backend od 02.10.2026; starszy go nie zwraca).
  _count?: { questions: number; exams?: number };
}

export interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  depth: number;
  sortOrder: number;
  questionCount: number;
  parentId: string | null;
  children?: Topic[];
}

export async function getSubjects(): Promise<Subject[]> {
  return api<Subject[]>("/subjects");
}

export async function getSubject(
  slug: string,
): Promise<Subject & { topics: Topic[] }> {
  return api(`/subjects/${slug}`);
}
