// ============================================================================
// openFreeSheet — „Zobacz swój arkusz →” po oddaniu darmowego arkusza
// src/lib/openFreeSheet.ts
//
// Oddany niepełny arkusz otwiera się w trybie dokańczania (zablokowane
// zadania z odpowiedziami + puste do zrobienia), pełny — na ekranie wyniku,
// gdzie widać cały arkusz z odpowiedziami.
// ============================================================================

import { continueExam } from "../api/exams";
import type { TrialStatus } from "../api/premium";

export async function openFreeSheet(navigation: any, trial: TrialStatus): Promise<void> {
  const toResults = () =>
    navigation.getParent()?.navigate("ExamTab", {
      screen: "ExamResults",
      params: { attemptId: trial.examAttemptId! },
    });
  if (!trial.canContinue || !trial.examId) {
    toResults();
    return;
  }
  try {
    await continueExam(trial.examAttemptId!);
    navigation.getParent()?.navigate("ExamTab", {
      screen: "ExamPlay",
      params: { examId: trial.examId, subjectId: "" },
    });
  } catch {
    toResults();
  }
}