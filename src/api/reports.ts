// ============================================================================
// src/api/reports.ts — Report question API
// ============================================================================

import { api } from "./client";

export type ReportCategory =
  | "WRONG_ANSWER"
  | "CONTENT_ERROR"
  | "UNCLEAR"
  | "MISSING_CONTENT"
  | "DISPLAY_BUG"
  | "OTHER";

export async function createReport(data: {
  questionId: string;
  category: ReportCategory;
  description: string;
}): Promise<{ ok: boolean; reportId: string; message: string }> {
  return api("/reports", { method: "POST", body: data });
}

export async function getMyReports(): Promise<{ reports: any[] }> {
  return api("/reports/my");
}
