// Liczba pytań darmowego quizu: angielski ma 5 dodatkowych pytań ze słownictwa
// (18), reszta przedmiotów 13. Źródło: backend services/diagnosis-v2.ts
// (v2QuestionCount). Gdy API zwraca questionCount, ono ma pierwszeństwo.
export function freeQuizCount(slug?: string | null): number {
  return /^angielski/.test(slug ?? "") ? 18 : 13;
}
