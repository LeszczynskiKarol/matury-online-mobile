// ============================================================================
// Etykiety typów zadań arkusza (Egzamin Live) — do listy zadań i nagłówka
// zadania na ekranie wyników. Lustro web ExamResults.tsx → getTypeLabel
// (jawna mapa + etykiety z rendererów przedmiotowych). Typ nieznany: pusty
// napis zamiast surowej nazwy („biz_abcd”), jak web po poprawce z 18.09.2026.
// ============================================================================

const EXPLICIT: Record<string, string> = {
  // Niemiecki PR
  listening_mcq_pr_de: "Hörverstehen – MCQ",
  reading_paragraph_match_de: "Leseverstehen – dopasowanie",
  reading_gapped_text_pr_de: "Leseverstehen – luki",
  reading_two_texts_de: "Leseverstehen – dwa teksty",
  mcq_cloze_de: "Środki jęz. – MCQ cloze",
  word_three_sentences_de: "Środki jęz. – wyraz w 3 zdaniach",
  sentence_transform_pr_de: "Środki jęz. – transformacja",
  writing_de_pr: "Wypowiedź pisemna",
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
  // Angielski
  listening_matching: "Listening — dopasuj",
  listening_mcq: "Listening — MCQ",
  listening_mcq_pr: "Listening — MCQ",
  listening_fill: "Listening — uzupełnij",
  reading_heading_match: "Reading — nagłówki",
  reading_mixed: "Reading — mieszane",
  reading_mcq: "Reading — MCQ",
  reading_gapped_text: "Reading — luki",
  reading_gapped_text_pr: "Reading — luki",
  reading_paragraph_match: "Reading — dopasowanie",
  reading_two_texts: "Reading — dwa teksty",
  reading_text_match: "Reading — dopasuj",
  reading_short_texts_mcq: "Reading — MCQ",
  reading_polish_gaps: "Reading — luki",
  mini_dialogues: "Mini-dialogi",
  both_sentences: "Obydwa zdania",
  open_cloze: "Luka otwarta",
  mcq_cloze: "Luki — MCQ",
  word_bank_cloze: "Luki — bank słów",
  word_formation: "Słowotwórstwo",
  functions_mcq: "Funkcje językowe",
  sentence_completion_pr: "Uzupełnij zdania",
  transformation: "Transformacja",
  writing_eng: "Wypowiedź pisemna",
  writing_eng_pr: "Wypowiedź pisemna",
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
  // Niemiecki PP
  listening_matching_de: "Hörverstehen – dopasuj",
  listening_mcq_de: "Hörverstehen – MCQ",
  listening_fill_de: "Hörverstehen – uzupełnij",
  reading_heading_match_de: "Leseverstehen – nagłówki",
  reading_mixed_de: "Leseverstehen – mieszane",
  reading_mcq_de: "Leseverstehen – MCQ",
  reading_gapped_text_de: "Leseverstehen – luki",
  mini_dialogues_de: "Minidialogi",
  both_sentences_de: "Oba zdania",
  open_cloze_de: "Luka otwarta",
  transformation_de: "Transformacja",
  writing_de: "Wypowiedź pisemna",
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
  if (EXPLICIT[t]) return EXPLICIT[t];
  const m = t.match(/^(hist|bio|chem|phys|geo|wos|info|biz|math)_(.+)$/);
  if (m && SUFFIX[m[2]]) return SUFFIX[m[2]];
  return "";
}
