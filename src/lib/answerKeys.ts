// ============================================================================
// Klucz odpowiedzi przychodzi PO odpowiedzi — scalanie z treścią pytania.
//
// Backend oddaje pytania bez kluczy (correctAnswer, isTrue, acceptedAnswers,
// pairs[].right, correctOrder, sampleAnswer, explanation…), a klucz wraca jako
// `reveal` razem z oceną (POST /answers) albo z podglądem
// (POST /questions/:id/reveal). `reveal` ma kształt treści (tablice z
// pozycjami), więc po scaleniu renderery czytają `content.correctAnswer` itd.
// jak dotąd. Lustro webowego lib/answer-keys.ts — zmieniać razem.
// ============================================================================

export function mergeAnswerKeys(base: any, reveal: any): any {
  if (reveal === null || reveal === undefined) return base;
  if (Array.isArray(reveal)) {
    const b = Array.isArray(base) ? base : [];
    const merged = reveal.map((r, i) =>
      r === null || r === undefined ? b[i] : mergeAnswerKeys(b[i], r),
    );
    return merged.concat(b.slice(reveal.length));
  }
  if (typeof reveal === "object") {
    const b =
      base && typeof base === "object" && !Array.isArray(base) ? base : {};
    const out: Record<string, any> = { ...b };
    for (const k of Object.keys(reveal)) out[k] = mergeAnswerKeys(b[k], reveal[k]);
    return out;
  }
  return reveal;
}
