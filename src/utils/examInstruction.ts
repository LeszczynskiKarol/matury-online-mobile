// Port z frontend/src/components/exam/ExamPlayer.tsx (cleanInstructionForDisplay).
// Instrukcje zadań egzaminacyjnych przychodzą z API z literalnymi "\n" (dwa znaki)
// i z powielonymi opcjami A/B/C/D, które renderujemy niżej jako przyciski.
// Bez tej normalizacji parseChemText traktuje "\nA" jako komendę LaTeX i zjada
// tekst (widoczne było jako "3.ą urbanizacji" zamiast "3.\n\nFazą urbanizacji").

type TaskLike = { type?: string; instruction?: string; content?: any };

const TYPES_WITH_RENDERED_OPTIONS = new Set([
  "chem_abcd",
  "chem_abcd_justify",
  "chem_multi_select",
  "geo_abcd",
  "geo_multi_select",
  "bio_abcd",
  "bio_multi_select",
  "closed_abcd",
  "phys_abcd",
  "phys_abcd_justified",
  "hist_abcd",
  "hist_abcd_justify",
  "hist_multi_select",
  "wos_abcd",
  "wos_abcd_justify",
  "wos_multi_select",
  "info_abcd",
  "info_multi_select",
]);

const TYPES_WITH_RENDERED_STATEMENTS = new Set([
  "chem_true_false",
  "true_false",
  "geo_true_false",
  "bio_true_false",
  "phys_true_false",
  "hist_true_false",
]);

export function normalizeInstructionNewlines(text: string | undefined): string {
  return (text || "").replace(/\n/g, "\n");
}

export function cleanInstructionForDisplay(task: TaskLike): string {
  const type = task.type || "";
  const content = task.content || {};
  const normalized = normalizeInstructionNewlines(task.instruction);

  // 1. Opcje A/B/C/D są w content.options / leftOptions+rightOptions —
  //    renderowane jako przyciski, więc wycinamy je z instrukcji.
  const hasRenderedOptions =
    (Array.isArray(content.options) && content.options.length > 0) ||
    (Array.isArray(content.leftOptions) && content.leftOptions.length > 0);
  if (TYPES_WITH_RENDERED_OPTIONS.has(type) && hasRenderedOptions) {
    const match = normalized.match(/\n\s*A\s*[.)–\-—]\s/);
    if (match && match.index !== undefined) {
      return normalized.slice(0, match.index).trim();
    }
    const inlineMatch = normalized.match(/\s{2,}A\s*[.)–\-—]\s/);
    if (inlineMatch && inlineMatch.index !== undefined) {
      return normalized.slice(0, inlineMatch.index).trim();
    }
  }

  // 2. Zdania P/F są w content.statements.
  if (
    TYPES_WITH_RENDERED_STATEMENTS.has(type) &&
    Array.isArray(content.statements) &&
    content.statements.length > 0
  ) {
    const match = normalized.match(/\n\s*1\s*[.)–\-—]\s/);
    if (match && match.index !== undefined) {
      return normalized.slice(0, match.index).trim();
    }
  }

  // 3. chem_fill_choose — zdania z "(a / b)" renderuje widget.
  if (type === "chem_fill_choose") {
    const lines = normalized.split("\n");
    const cutAt = lines.findIndex((l) => /\([^)]*\/[^)]*\)/.test(l));
    if (cutAt > 0) return lines.slice(0, cutAt).join("\n").trim();
  }

  // 4. chem_abcd_justify — lista uzasadnień jest w content.justifications.
  if (type === "chem_abcd_justify") {
    const match = normalized.match(/\n\s*ponieważ\s*\n/i);
    if (match && match.index !== undefined) {
      return normalized.slice(0, match.index).trim() + "\n\nponieważ...";
    }
    const listMatch = normalized.match(/\bponieważ\b[\s\S]*?\n\s*1\s*[.)]\s/i);
    if (listMatch && listMatch.index !== undefined) {
      return normalized
        .slice(0, listMatch.index + listMatch[0].indexOf("1") - 1)
        .trim();
    }
  }

  // 5. Tematy wypracowań są w content.topics.
  if (type === "hist_essay_15pt" || type === "wos_essay_10pt") {
    const match = normalized.match(/\n\s*TEMAT\s*\d+\s*[:.]/i);
    if (match && match.index !== undefined) {
      return normalized.slice(0, match.index).trim();
    }
  }

  return normalized.trim();
}
