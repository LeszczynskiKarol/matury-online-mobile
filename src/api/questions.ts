// ============================================================================
// Questions API — /api/questions/*
// ============================================================================

import { api } from './client';

export type QuestionType =
  | 'CLOSED'
  | 'MULTI_SELECT'
  | 'OPEN'
  | 'FILL_IN'
  | 'ESSAY'
  | 'MATCHING'
  | 'ORDERING'
  | 'TRUE_FALSE'
  | 'ERROR_FIND'
  | 'GRAPH_INTERPRET'
  | 'TABLE_DATA'
  | 'WIAZKA'
  | 'PROOF_ORDER'
  | 'CLOZE'
  | 'LISTENING'
  | 'DIAGRAM_LABEL'
  | 'EXPERIMENT_DESIGN'
  | 'CROSS_PUNNETT'
  | 'CALCULATION';

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: number;
  points: number;
  content: any; // JSON — varies per type
  source: string | null;
  explanation?: string | null;
  topic: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface FilterOptions {
  topics: { id: string; name: string; slug: string; questionCount: number; depth: number; sortOrder: number }[];
  types: { type: string; count: number }[];
  difficulties: { difficulty: number; count: number }[];
  sources: { source: string; count: number }[];
  totalQuestions: number;
}

interface QuestionsResponse {
  questions: Question[];
  total: number;
}

export async function getQuestions(params: {
  subjectId: string;
  topicId?: string;
  topicIds?: string;
  type?: string;
  types?: string;
  difficulty?: number;
  difficulties?: string;
  sources?: string;
  exclude?: string;
  shuffle?: boolean;
  limit?: number;
  offset?: number;
}): Promise<QuestionsResponse> {
  return api<QuestionsResponse>('/questions', { params: params as any });
}

export async function getFilterOptions(subjectId: string): Promise<FilterOptions> {
  return api<FilterOptions>('/questions/filter-options', {
    params: { subjectId },
  });
}

export async function getQuestion(id: string): Promise<Question> {
  return api<Question>(`/questions/${id}`);
}

export async function skipQuestion(
  id: string,
  sessionId?: string,
): Promise<{ ok: boolean }> {
  return api(`/questions/${id}/skip`, {
    method: 'POST',
    body: sessionId ? { sessionId } : undefined,
  });
}
