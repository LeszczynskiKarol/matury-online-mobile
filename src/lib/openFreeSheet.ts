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
  if (!trial.examId) {
    toResults();
    return;
  }
  // Wszystko rozwiązane: przegląd całego arkusza w odtwarzaczu (każde
  // zadanie z oceną i wyjaśnieniem), nie sam ekran wyniku (Karol 2.10.2026).
  if (!trial.canContinue) {
    navigation.getParent()?.navigate("ExamTab", {
      screen: "ExamPlay",
      params: { examId: trial.examId, subjectId: "", reviewAttemptId: trial.examAttemptId },
    });
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