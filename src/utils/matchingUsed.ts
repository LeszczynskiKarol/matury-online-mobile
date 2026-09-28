/**
 * Znacznik „już przypisane” w zadaniach na dopasowanie (Karol 28.09.2026).
 *
 * Opcja wybrana już w INNYM wierszu dostaje mały zielony „✓” przed tekstem.
 * Znacznik NICZEGO nie blokuje: to, co się stanie po stuknięciu (przeniesienie,
 * duplikat, blokada), zależy wyłącznie od renderera — jak dotąd.
 * Własny wybór bieżącego wiersza nie jest oznaczany.
 */

/** Zielony znacznika — ten sam w jasnym i ciemnym motywie (green-600). */
export const USED_MARK_COLOR = "#16a34a";

/** Klucze wierszy (poza `rowKey`), w których wybrano już `option`. */
export function usedAt(
  answers: unknown,
  rowKey: string | number,
  option: string | number,
): string[] {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return [];
  const opt = String(option);
  if (!opt) return [];
  const row = String(rowKey);
  return Object.entries(answers as Record<string, unknown>)
    .filter(([k, v]) => k !== row && v != null && String(v) === opt)
    .map(([k]) => k);
}
