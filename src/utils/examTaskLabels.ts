// ============================================================================
// Etykiety typów zadań arkusza (Egzamin Live) — do listy zadań i nagłówka
// zadania na ekranie wyników. Lustro web ExamResults.tsx → getTypeLabel
// (jawna mapa + etykiety z rendererów przedmiotowych). Typ nieznany: pusty
// napis zamiast surowej nazwy („biz_abcd”), jak web po poprawce z 18.09.2026.
// Arkusze językowe (EN/DE, matura i E8) — polskie etykiety z jednego słownika
// (utils/languageTaskLabels.ts, lustro webowego lib/language-task-labels.ts).
// ============================================================================

import { languageTaskLabel } from "./languageTaskLabels";

const EXPLICIT: Record<string, string> = {
  // Polski
  open_short: "Krótka odpowiedź",
  open_explain: "Wyjaśnij",
  open_compare: "Porównaj",
  true_false: "P/F",
  closed_abcd: "ABCD",
  matching: "Dopasuj",
  fill_table: "Tabela",
  notatka: "Notatka",
  wypracowanie: "Wypracowanie",
  // Matematyka
  math_abcd: "ABCD",
  math_abcd_justified: "ABCD + uzasad.",
  math_true_false: "P/F",
  math_true_false_3: "P/F (3 stw.)",
  math_two_part: "Dwuczęściowe",
  math_multi_select: "Wielokrotny",
  math_fill_blank: "Uzupełnij",
  math_short_calc: "Oblicz",
  math_extended_calc: "Oblicz (rozszerz.)",
  math_proof: "Dowód",
  math_optimization: "Optymalizacja",
  math_pr_short: "Oblicz / Wyznacz",
  math_pr_extended: "Rozwiąż (rozszerz.)",
  math_pr_proof: "Dowód / Wykaż",
  math_pr_optimization: "Optymalizacja",
  math_pr_parametric: "Z parametrem",
  // Historia / WOS — wypracowania
  hist_essay_15pt: "Wypracowanie",
  wos_essay_5pt: "Wypowiedź",
  wos_essay_7pt: "Wypowiedź",
  wos_essay_10pt: "Wypracowanie",
  // Informatyka
  info_sql: "SQL",
  info_spreadsheet: "Arkusz kalkulacyjny",
  info_programming: "Programowanie",
  info_algorithm: "Algorytm",
  info_analysis: "Analiza",
  // Chemia / fizyka / biologia — typy bez odpowiednika w sufiksach
  chem_equation: "Równanie reakcji",
  chem_electronic: "Konfiguracja elektronowa",
  chem_scheme_fill: "Uzupełnij schemat",
  phys_nuclear: "Fizyka jądrowa",
  phys_derivation: "Wyprowadzenie",
  phys_construction: "Konstrukcja",
  phys_diagram: "Rysunek / wykres",
  bio_cross_punnett: "Krzyżówka",
  hist_identify_persons: "Identyfikuj postacie",
  wos_identify_persons: "Identyfikuj postacie",
  hist_interpret_visual: "Interpretacja źródła",
  hist_style_recognition: "Rozpoznaj styl",
  hist_compare_sources: "Porównaj źródła",
  biz_case_analysis: "Studium przypadku",
  biz_calc: "Obliczenia",
};

/** Typy przedmiotowe (hist_*, bio_*…) — etykieta z sufiksu. */
const SUFFIX: Record<string, string> = {
  abcd: "ABCD",
  abcd_justified: "ABCD + uzasad.",
  abcd_justify: "ABCD + uzasad.",
  true_false: "P/F",
  multi_select: "Wielokrotny wybór",
  matching: "Dopasuj",
  sequence: "Uporządkuj",
  fill_choose: "Uzupełnij",
  fill_blank: "Uzupełnij",
  fill_value: "Uzupełnij",
  fill_text: "Uzupełnij tekst",
  fill_table: "Tabela",
  table_fill: "Tabela",
  open_short: "Krótka odpowiedź",
  open_explain: "Wyjaśnij",
  open_extended: "Rozbudowana odpowiedź",
  open_compare: "Porównaj",
  explain: "Wyjaśnij",
  decide_justify: "Rozstrzygnij + uzasad.",
  arguments: "Argumenty",
  propose: "Zaproponuj",
  calculation: "Obliczenia",
  short_calc: "Oblicz",
  calc: "Obliczenia",
  experiment: "Doświadczenie",
  problem: "Problem",
};

export function examTaskTypeLabel(type: string | null | undefined): string {
  const t = String(type ?? "");
  if (!t) return "";
  const lang = languageTaskLabel(t);
  if (lang) return lang;
  if (EXPLICIT[t]) return EXPLICIT[t];
  const m = t.match(/^(hist|bio|chem|phys|geo|wos|info|biz|math)_(.+)$/);
  if (m && SUFFIX[m[2]]) return SUFFIX[m[2]];
  return "";
}
