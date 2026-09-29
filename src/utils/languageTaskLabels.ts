// ============================================================================
// Polskie etykiety zadań i części arkuszy językowych (angielski, niemiecki —
// matura PP/PR i egzamin ósmoklasisty).
// src/utils/languageTaskLabels.ts
//
// Uczeń widział w arkuszu i wynikach mieszankę angielskiego, niemieckiego
// i skrótów: „Listening — MCQ”, „Reading — nagłówki”, „Hörverstehen – MCQ”,
// „Środki jęz. – MCQ cloze”, a w nagłówkach części „Part 1. …”/„Teil 1. …”.
// Jeden słownik dla wszystkich typów silnika, spójny schemat
// „<sprawność> — <forma zadania>”, bez „MCQ”/„cloze”.
//
// Nazwy części pochodzą z treści arkusza w bazie (content.parts[].name) i są
// niejednolite („Part 1. Listening Comprehension”, „Teil 2. Leseverstehen”,
// „Część 4. Wypowiedź pisemną”) — normalizujemy je przy wyświetlaniu,
// bazy nie ruszamy.
//
// Egzaminy Cambridge (B2 First, C1 Advanced) mają oficjalne angielskie nazwy
// części („Reading and Use of English”, „Part 5 · …”) — ich nie tłumaczymy.
//
// Ten sam plik żyje w matury-online.pl, zdaj-angielski-web
// i osmoklasista-online-web (src/lib/language-task-labels.ts); ten plik jest
// jego lustrem w apkach matury-online, zdaj-angielski i osmoklasista-online.
// ============================================================================

const LISTENING = "Słuchanie";
const READING = "Czytanie";
const LANGUAGE = "Środki językowe";

const BASE_LABELS: Record<string, string> = {
  // ── Rozumienie ze słuchu ──
  listening_matching: `${LISTENING} — dobieranie`,
  listening_mcq: `${LISTENING} — wybór odpowiedzi`,
  listening_mcq_pr: `${LISTENING} — wybór odpowiedzi`,
  listening_fill: `${LISTENING} — uzupełnianie luk`,
  // ── Rozumienie tekstów pisanych ──
  reading_heading_match: `${READING} — dobieranie nagłówków`,
  reading_paragraph_match: `${READING} — dobieranie do części tekstu`,
  reading_text_match: `${READING} — dobieranie tekstów`,
  reading_mcq: `${READING} — wybór odpowiedzi`,
  reading_short_texts_mcq: `${READING} — krótkie teksty`,
  reading_mixed: `${READING} — zadanie mieszane`,
  reading_two_texts: `${READING} — dwa teksty`,
  reading_gapped_text: `${READING} — tekst z lukami`,
  reading_gapped_text_pr: `${READING} — tekst z lukami`,
  reading_polish_gaps: `${READING} — luki po polsku`,
  // ── Znajomość środków językowych ──
  mcq_cloze: `${LANGUAGE} — wybór wyrazów w tekście`,
  open_cloze: `${LANGUAGE} — uzupełnianie luk`,
  word_bank_cloze: `${LANGUAGE} — wyrazy z ramki`,
  word_formation: `${LANGUAGE} — słowotwórstwo`,
  both_sentences: `${LANGUAGE} — wyraz do dwóch zdań`,
  word_three_sentences: `${LANGUAGE} — wyraz do trzech zdań`,
  mini_dialogues: `${LANGUAGE} — minidialogi`,
  transformation: `${LANGUAGE} — przekształcanie zdań`,
  sentence_transform_pr: `${LANGUAGE} — przekształcanie zdań`,
  sentence_completion_pr: `${LANGUAGE} — uzupełnianie zdań`,
  // ── Egzamin ósmoklasisty: funkcje językowe ──
  functions_mcq: "Funkcje językowe — wybór reakcji",
  // ── Wypowiedź pisemna ──
  writing_eng: "Wypowiedź pisemna",
  writing_eng_pr: "Wypowiedź pisemna",
  writing: "Wypowiedź pisemna",
  writing_pr: "Wypowiedź pisemna",
};

/** Typ silnika bez końcówki języka: `listening_mcq_pr_de` → `listening_mcq_pr`,
 *  `writing_de_pr` → `writing_pr`, `writing_de` → `writing`. */
function baseType(type: string): string {
  return type.replace(/_de(?=_pr$|$)/, "");
}

/** Polska etykieta zadania językowego; "" gdy typ nie jest językowy. */
export function languageTaskLabel(type: string | null | undefined): string {
  if (!type) return "";
  return BASE_LABELS[type] ?? BASE_LABELS[baseType(type)] ?? "";
}

/** Czy typ zadania należy do arkusza językowego (EN/DE, matura lub E8). */
export function isLanguageTaskType(type: string | null | undefined): boolean {
  return !!languageTaskLabel(type);
}

const PART_TITLES: Record<string, string> = {
  "listening comprehension": "Rozumienie ze słuchu",
  listening: "Rozumienie ze słuchu",
  hörverstehen: "Rozumienie ze słuchu",
  "reading comprehension": "Rozumienie tekstów pisanych",
  reading: "Rozumienie tekstów pisanych",
  leseverstehen: "Rozumienie tekstów pisanych",
  "use of english": "Znajomość środków językowych",
  "grammar and vocabulary": "Znajomość środków językowych",
  "language in use": "Znajomość środków językowych",
  sprachbausteine: "Znajomość środków językowych",
  "sprachliche mittel": "Znajomość środków językowych",
  writing: "Wypowiedź pisemna",
  "schriftlicher ausdruck": "Wypowiedź pisemna",
  "wypowiedź pisemną": "Wypowiedź pisemna",
};

const CAMBRIDGE_SLUGS = new Set(["angielski-fce", "angielski-cae"]);

/**
 * Nazwa części arkusza do wyświetlenia. „Part 1. Listening Comprehension”,
 * „Teil 1. Hörverstehen”, „Część 1. Rozumienie ze słuchu” → „Część 1.
 * Rozumienie ze słuchu” (`short` → „Cz. 1. …”, do wąskich list zadań).
 * Nazwy spoza słownika zostają, zmienia się tylko przedrostek numeru.
 */
export function examPartName(
  name: string | null | undefined,
  opts: { short?: boolean; subjectSlug?: string | null } = {},
): string {
  if (!name) return "";
  if (opts.subjectSlug && CAMBRIDGE_SLUGS.has(opts.subjectSlug)) return name;
  const prefix = opts.short ? "Cz." : "Część";
  const m = name.match(/^\s*(?:Part|Teil|Część|Cz\.)\s*(\d+)\s*[.:]?\s*(.*)$/i);
  const rawTitle = (m ? m[2] : name).trim();
  const title = PART_TITLES[rawTitle.toLowerCase()] ?? rawTitle;
  if (m) return title ? `${prefix} ${m[1]}. ${title}` : `${prefix} ${m[1]}.`;
  // „Część I. …” (polski) — w wąskiej liście skrót jak dotąd.
  return opts.short ? title.replace(/^Część\s+/, "Cz. ") : title;
}
