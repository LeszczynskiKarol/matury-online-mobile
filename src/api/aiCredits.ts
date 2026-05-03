// src/api/aiCredits.ts

import { api } from "./client";

export interface AiCreditEntry {
  id: string;
  type: string;
  label: string;
  credits: number;
  context: string | null;
  createdAt: string;
}

export interface AiCreditHistoryResponse {
  entries: AiCreditEntry[];
  total: number;
  monthlyStats: { month: string; used: number; added: number }[];
  hasMore: boolean;
}

export async function getAiCreditsHistory(
  page: number = 1,
  limit: number = 30,
): Promise<AiCreditHistoryResponse> {
  return api("/ai-credits/history", { params: { page, limit } });
}
