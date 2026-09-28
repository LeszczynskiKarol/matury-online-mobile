// =============================================================================
// gapText.ts — tekst z lukami w zadaniach „Uzupełnij tekst/zdanie/notatkę”
// (wos_fill_text, biz_fill_text, info_fill_blank). Ten sam parser jest na
// webie (frontend/src/lib/gap-text.ts) — zmiany wprowadzać w obu miejscach.
//
// Luki w poleceniu mają w bazie różne zapisy — wszystkie trafiają tutaj:
//   „(1) …………”, „(1) …”, „(1) ......”       numer przed kropkami
//   „........(1)........”, „___(1)___”       numer między kropkami
//   „………… (a)”                               numer po kropkach
//   „[1]”, „{{1}}”                            numer w nawiasie
//   „…”, „...”, „_____” bez numeru            kolejna luka z content.blanks
//   „(1)” bez kropek, tylko w tekście pod poleceniem (np. „…niższe niż (1)
//                                             wynagrodzenia”)
// Gdy luk nie da się jednoznacznie przypisać do content.blanks, parser zwraca
// null i renderer pokazuje ponumerowane pola pod poleceniem.
// =============================================================================

export type GapSegment =
  | { kind: "text"; text: string }
  | { kind: "gap"; blankId: string; num: string };

export interface GapTextParse {
  /** Polecenie nad tekstem („Uzupełnij tekst, wpisując…”). */
  lead: string;
  /** Akapity tekstu z lukami (każdy akapit = osobny wiersz). */
  paragraphs: GapSegment[][];
}

export const GAP_TEXT_TYPES = new Set([
  "wos_fill_text",
  "biz_fill_text",
  "info_fill_blank",
]);

export function isGapTextType(type: string | undefined): boolean {
  return !!type && GAP_TEXT_TYPES.has(type);
}

const DOTS = "(?:…[.…]*|\\.{3,}[.…]*|_{3,})";
const ID = "([0-9]{1,2}|[a-hA-H])";
// Kolejność alternatyw ma znaczenie: przy tej samej pozycji wygrywa pierwsza.
const MARKER_RE = new RegExp(
  [
    `${DOTS}\\(${ID}\\)${DOTS}`, // ........(1)........  /  ___(1)___
    `\\(${ID}\\)[ \\t]*${DOTS}`, // (1) …………
    `${DOTS}[ \\t]*\\(${ID}\\)`, // ………… (a)
    `\\[${ID}\\]`, // [1]
    `\\{\\{?${ID}\\}?\\}`, // {{1}} / {1}
    DOTS, // … bez numeru
  ].join("|"),
  "g",
);
const BARE_RE = new RegExp(`\\(${ID}\\)`, "g");

function normalize(text: string | undefined): string {
  return String(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n");
}

function blanksOf(task: any): any[] {
  const b = task?.content?.blanks;
  return Array.isArray(b) ? b.filter((x: any) => x && x.id != null) : [];
}

/** Numer luki do pokazania przy polu (1, 2, a, b…). */
export function gapNumber(blank: any, index: number, marker?: string): string {
  if (marker) return marker;
  const id = String(blank?.id ?? "");
  if (/^(?:[0-9]{1,2}|[a-h])$/i.test(id)) return id;
  const m = String(blank?.label ?? "").match(/^\s*\(([0-9a-h]{1,2})\)/i);
  if (m) return m[1];
  return String(index + 1);
}

function resolveBlank(blanks: any[], raw: string): number {
  const exact = blanks.findIndex(
    (b) => String(b.id).toLowerCase() === raw.toLowerCase(),
  );
  if (exact >= 0) return exact;
  if (/^[0-9]+$/.test(raw)) {
    const n = parseInt(raw, 10) - 1;
    return n >= 0 && n < blanks.length ? n : -1;
  }
  if (/^[a-h]$/i.test(raw)) {
    const n = raw.toLowerCase().charCodeAt(0) - 97;
    return n < blanks.length ? n : -1;
  }
  return -1;
}

type RawGap = { start: number; end: number; marker: string | null };

function findGaps(text: string, re: RegExp): RawGap[] {
  const out: RawGap[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    const marker = m.slice(1).find((g) => g !== undefined) ?? null;
    // „2^6, 2^5, …, 2^0”, „1, 3, 1, 3, … (cyfry…” — wyliczenie, nie luka.
    if (!marker && /,\s*$/.test(text.slice(Math.max(0, m.index - 3), m.index))) continue;
    out.push({ start: m.index, end: m.index + m[0].length, marker });
  }
  return out;
}

/** Przypisuje luki do content.blanks; null, gdy się nie da jednoznacznie. */
function assign(gaps: RawGap[], blanks: any[]): number[] | null {
  if (gaps.length !== blanks.length) return null;
  const used = new Set<number>();
  const idx: number[] = gaps.map((g) => {
    if (!g.marker) return -1;
    const i = resolveBlank(blanks, g.marker);
    if (i < 0 || used.has(i)) return -2;
    used.add(i);
    return i;
  });
  if (idx.includes(-2)) return null;
  let next = 0;
  for (let k = 0; k < idx.length; k++) {
    if (idx[k] !== -1) continue;
    while (used.has(next)) next++;
    if (next >= blanks.length) return null;
    idx[k] = next;
    used.add(next);
  }
  return used.size === blanks.length ? idx : null;
}

function buildParagraphs(
  body: string,
  gaps: RawGap[],
  idx: number[],
  blanks: any[],
): GapSegment[][] {
  const segs: GapSegment[] = [];
  let pos = 0;
  gaps.forEach((g, k) => {
    let before = body.slice(pos, g.start);
    if (k > 0) before = before.replace(/^[ \t]+(?=[.,;:!?)”»])/, "");
    if (before) segs.push({ kind: "text", text: before });
    const b = blanks[idx[k]];
    segs.push({
      kind: "gap",
      blankId: String(b.id),
      num: gapNumber(b, idx[k], g.marker ?? undefined),
    });
    pos = g.end;
  });
  let rest = body.slice(pos);
  if (gaps.length > 0) rest = rest.replace(/^[ \t]+(?=[.,;:!?)”»])/, "");
  if (rest) segs.push({ kind: "text", text: rest });

  // Podział na akapity po znakach nowej linii w segmentach tekstu.
  const paragraphs: GapSegment[][] = [[]];
  for (const s of segs) {
    if (s.kind === "gap") {
      paragraphs[paragraphs.length - 1].push(s);
      continue;
    }
    const lines = s.text.split("\n");
    lines.forEach((line, li) => {
      if (li > 0) paragraphs.push([]);
      if (line) paragraphs[paragraphs.length - 1].push({ kind: "text", text: line });
    });
  }
  return paragraphs
    .map((p) => {
      // obetnij spacje na brzegach akapitu
      const q = [...p];
      if (q[0]?.kind === "text") q[0] = { kind: "text", text: q[0].text.replace(/^\s+/, "") };
      const l = q.length - 1;
      if (q[l]?.kind === "text") q[l] = { kind: "text", text: (q[l] as any).text.replace(/\s+$/, "") };
      return q.filter((s) => s.kind === "gap" || s.text.length > 0);
    })
    .filter((p) => p.length > 0);
}

/** Gdzie kończy się polecenie, a zaczyna tekst z lukami. */
function leadCut(text: string, firstGap: number): number {
  const nl = text.lastIndexOf("\n", firstGap);
  if (nl >= 0) return nl + 1;
  // Jeden akapit: polecenie to zdania przed zdaniem z pierwszą luką.
  const head = text.slice(0, firstGap);
  const re = /[.:!?][”"»]?\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„(])/g;
  let cut = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) cut = m.index + m[0].length;
  return cut;
}

export function parseGapText(task: any): GapTextParse | null {
  const blanks = blanksOf(task);
  if (blanks.length === 0) return null;
  const text = normalize(task?.instruction);
  if (!text.trim()) return null;

  // 1) Luki z kropkami / podkreśleniami / nawiasami. Gdy numery się nie
  //    zgadzają z blanks (np. „...(5)” to zapis systemu piątkowego, nie numer
  //    luki) — drugie podejście: same kropki, luki po kolei.
  for (const re of [MARKER_RE, new RegExp(DOTS, "g")]) {
    const gaps = findGaps(text, new RegExp(re.source, "g"));
    if (gaps.length === 0) continue;
    const cut = leadCut(text, gaps[0].start);
    const lead = text.slice(0, cut).trim();
    const body = text.slice(cut);
    const shifted = gaps.map((g) => ({ ...g, start: g.start - cut, end: g.end - cut }));
    const idx = assign(shifted, blanks);
    if (idx) return { lead, paragraphs: buildParagraphs(body, shifted, idx, blanks) };
  }

  // 2) Same „(1)”, „(2)” w tekście pod poleceniem — najkrótszy końcowy
  //    fragment (od początku wiersza), w którym każda luka występuje raz.
  const lines = text.split("\n");
  for (let k = lines.length - 1; k >= 1; k--) {
    const body = lines.slice(k).join("\n");
    const bare = findGaps(body, new RegExp(BARE_RE.source, "g"));
    if (bare.length !== blanks.length) continue;
    const idx = assign(bare, blanks);
    if (!idx) continue;
    const lead = lines.slice(0, k).join("\n").trim();
    if (!lead) return null;
    return { lead, paragraphs: buildParagraphs(body, bare, idx, blanks) };
  }
  return null;
}

/** Polecenie bez tekstu z lukami (tekst rysuje renderer luk). */
export function gapTextLead(task: any): string | null {
  if (!isGapTextType(task?.type)) return null;
  const p = parseGapText(task);
  return p ? p.lead : null;
}

/** Poprawne wpisy dla luki (acceptedAnswers albo correctAnswer + alternatywy). */
export function acceptedForBlank(blank: any): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    const s = v == null ? "" : String(v).trim();
    if (s && !out.includes(s)) out.push(s);
  };
  if (Array.isArray(blank?.acceptedAnswers)) blank.acceptedAnswers.forEach(push);
  push(blank?.correctAnswer);
  if (Array.isArray(blank?.acceptAlternatives)) blank.acceptAlternatives.forEach(push);
  if (Array.isArray(blank?.correctAnswers)) blank.correctAnswers.forEach(push);
  return out;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .trim();
}

/** true/false wg klucza; null, gdy klucza brak (np. zadanie oceniane przez AI bez listy). */
export function blankIsCorrect(blank: any, answer: any): boolean | null {
  const acc = acceptedForBlank(blank);
  if (acc.length === 0) return null;
  const a = norm(String(answer ?? ""));
  if (!a) return false;
  return acc.some((x) => norm(x) === a || norm(x).replace(/\s/g, "") === a.replace(/\s/g, ""));
}

/** Etykieta pola, gdy nie ma tekstu z lukami: „Gmina”, „organ stanowiący gminy”. */
export function blankLabel(blank: any): string {
  const l = String(blank?.label ?? blank?.prompt ?? "").replace(/^\s*\([0-9a-h]{1,2}\)\s*/i, "").trim();
  return l ? l.charAt(0).toUpperCase() + l.slice(1) : "";
}
