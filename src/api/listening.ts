// ============================================================================
// Listening API — /api/listening/*
// ============================================================================

import { api } from "./client";

interface ListeningStartResponse {
  sessionId: string;
  question: {
    id: string;
    type: "LISTENING";
    difficulty: number;
    points: number;
    content: any;
    topic: { id: string; name: string; slug: string };
  };
  error?: string;
  code?: string;
  remaining?: number;
}

interface ListeningNextResponse {
  question: {
    id: string;
    type: "LISTENING";
    difficulty: number;
    points: number;
    content: any;
    topic: { id: string; name: string; slug: string };
  };
  error?: string;
  retry?: boolean;
}

export async function startListening(params: {
  subjectId: string;
  difficulty?: number;
}): Promise<ListeningStartResponse> {
  return api<ListeningStartResponse>("/listening/start", {
    method: "POST",
    body: params,
    timeout: 60000, // listening generation takes 20-30s
  });
}

export async function nextListening(params: {
  sessionId: string;
  subjectId: string;
  difficulty?: number;
}): Promise<ListeningNextResponse> {
  return api<ListeningNextResponse>("/listening/next", {
    method: "POST",
    body: params,
    timeout: 60000,
  });
}

export async function endListening(
  sessionId: string,
): Promise<{ ok: boolean }> {
  return api("/listening/end", {
    method: "POST",
    body: { sessionId },
  });
}
