// ============================================================================
// questionLayout — rozpoznanie struktury treści pytania (bez JSX)
// src/lib/questionLayout.ts
//
// TEN SAM PLIK leży w: zdaj-angielski-web, matury-online.pl/frontend,
// zdaj-angielski-mobile, matury-online-mobile (src/lib/questionLayout.ts).
// Zmiana w jednym = zmiana we wszystkich — i ponowny audyt całej bazy
// (skrypt: matury-online.pl/backend/scripts/audit-question-layout.ts).
//
// Renderery wkładały całą treść pytania do jednego nagłówka, więc teksty
// źródłowe zlewały się w jeden gruby akapit (zgłoszenie 25.09.2026).
// Rozpoznajemy dwie struktury, które JUŻ są w bazie (dane bez zmian):
//
//  1. "speakers" — kilka osób / tekstów (multiple matching FCE/CAE/E8):
//       polecenie ⏎ A – Ola: … ⏎ B – Bartek: …   (także „A. Ola:", „A) Ola:")
//     → polecenie + karta na osobę (litera, imię, tekst).
//
//  2. "passage" — jeden fragment do przeczytania, stojący POZA zdaniem:
//       polecenie: ⏎ „tekst ≥ 100 znaków" ⏎ Pytanie?
//     → polecenie, fragment na karcie, pytanie.
//     Cytat w środku zdania („Dwuwiersz „…” pokazuje, że…") zostaje tekstem.
//
//  3. "plain" — wszystko inne, z zachowaniem akapitów.
//
// Format, który generatory MAJĄ produkować, żeby to działało:
// matury-online.pl/backend/src/services/question-layout-rules.md
// ============================================================================

export type QuestionLayout =
  | { kind: "plain"; text: string }
  | {
      kind: "speakers";
      intro: string;
      items: (
        | { kind: "speaker"; letter: string; name: string; body: string }
        | { kind: "text"; text: string }
      )[];
    }
  | { kind: "passage"; before: string; passage: string; after: string };

// „A – Ola:", „B - Reviewer B:", „C — Marta Kowalczyk:", „A. Lena:", „A) Tom:"
export const SPEAKER_RE = /^([A-H])\s*(?:[–—-]|\.|\))\s*([^:\n]{1,40}):\s*([\s\S]*)$/;
// Fragment w cudzysłowie: „…” albo "…" (min. 100 znaków — krótkie cytaty
// słówek w poleceniach zostają tekstem).
const PASSAGE_RE = /(„[^”]{100,}”|"[^"]{100,}")/;
const PASSAGE_ALL_RE = /(„[^”]{100,}”|"[^"]{100,}")/g;

export function splitParagraphs(raw: string): string[] {
  return raw
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function questionLayout(text: string | null | undefined): QuestionLayout {
  const raw = String(text ?? "");
  const paragraphs = splitParagraphs(raw);

  // ── 1. Kilka osób ─────────────────────────────────────────────────────
  const speakerCount = paragraphs.filter((p) => SPEAKER_RE.test(p)).length;
  if (paragraphs.length > 1 && speakerCount >= 2 && !SPEAKER_RE.test(paragraphs[0])) {
    const [intro, ...rest] = paragraphs;
    return {
      kind: "speakers",
      intro,
      items: rest.map((p) => {
        const m = p.match(SPEAKER_RE);
        if (!m) return { kind: "text" as const, text: p };
        const body = m[3].trim().replace(/^[„"]([\s\S]*)[”"]$/, "$1");
        return { kind: "speaker" as const, letter: m[1], name: m[2].trim(), body };
      }),
    };
  }

  // ── 2. Jeden fragment poza zdaniem ────────────────────────────────────
  const all = raw.match(PASSAGE_ALL_RE);
  if (all && all.length === 1) {
    const m = raw.match(PASSAGE_RE)!;
    const before = raw.slice(0, m.index);
    const after = raw.slice(m.index! + m[0].length);
    const beforeOk = before.trim() === "" || /[:.?!]\s*$|\n\s*$/.test(before);
    const afterT = after.replace(/^[ \t]+/, "");
    // Nowe zdanie po cytacie — także po kropce za cudzysłowem („…”. Jaką…).
    const afterOk =
      afterT.trim() === "" ||
      /^\.?\s*\n/.test(afterT) ||
      /^\.?\s*[A-ZĄĆĘŁŃÓŚŹŻ0-9„"(]/.test(afterT);
    // Sam cytat bez polecenia i bez pytania (np. zdanie z luką „___ she had…")
    // to po prostu treść pytania — karta fragmentu wisiałaby bez kontekstu.
    const hasContext = before.trim() !== "" || after.trim() !== "";
    if (beforeOk && afterOk && hasContext) {
      return {
        kind: "passage",
        before: before.trim(),
        passage: m[0].slice(1, -1).trim(),
        after: after.trim().replace(/^\.\s*/, ""),
      };
    }
  }

  return { kind: "plain", text: raw };
}
