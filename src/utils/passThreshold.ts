// ============================================================================
// Próg zdawalności 30% — tylko matura PP z przedmiotu obowiązkowego
// (polski, matematyka, język obcy). Rozszerzenia i przedmioty dodatkowe
// (biologia, chemia, fizyka, geografia, historia, WOS, informatyka, biznes)
// progu nie mają, więc „35% — zdany” i „zapas nad progiem” byłyby tam
// nieprawdą (Karol 28.09.2026).
//
// Ta sama reguła: backend services/subject-kind.ts (hasPassThreshold)
// i web frontend/src/lib/pass-threshold.ts (matury-online.pl).
// ============================================================================

export const PASS_PERCENT = 30;

const OBLIGATORY_PP_SUBJECTS = new Set(["polski", "matematyka", "angielski", "niemiecki"]);

/**
 * Czy wynik arkusza ma próg zdawalności? Bez sluga (starsza odpowiedź API)
 * decyduje sam poziom — na matury-online.pl arkusze PP są wyłącznie
 * z przedmiotów obowiązkowych.
 */
export function hasPassThreshold(slug?: string | null, level?: string | null): boolean {
  if ((level ?? "").toUpperCase() !== "PODSTAWOWY") return false;
  if (!slug) return true;
  return OBLIGATORY_PP_SUBJECTS.has(slug);
}

/**
 * Linia werdyktu zapisana w feedbacku (predictedMatura). Starsze oceny mają
 * tam „35% — zdany (próg: 30%)” także dla rozszerzeń — przy egzaminie bez
 * progu taką linię ukrywamy zamiast pokazywać nieprawdę.
 */
export function verdictLineFor(
  line: string | null | undefined,
  slug?: string | null,
  level?: string | null,
): string | null {
  if (!line) return null;
  if (!hasPassThreshold(slug, level) && /zdan|próg|prog(u|iem)/i.test(line) && !/nie ma progu/i.test(line)) {
    return null;
  }
  return line;
}
