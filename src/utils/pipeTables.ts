/**
 * pipe-tables — tabele Markdown („| a | b |”) w tekście do wyświetlenia.
 *
 * Port parsera z backend/src/services/pipe-tables.ts (splitPipeTables) —
 * TE SAME reguły: kreski w $…$, $$…$$, `…`, ```…``` i `\|` nie dzielą
 * komórek; wiersz z ramką ≥ 2 komórki, bez ramki ≥ 3; wiersz wyrównania
 * (|---|:---:|) pomijany; „Etykieta: a | b | c” rozcinane, gdy tak wyglądają
 * wszystkie wiersze; blok o nierównej liczbie kolumn (albo same puste
 * komórki) NIE jest tabelą i zostaje zwykłym tekstem.
 *
 * Backend przenosi tabele z treści do pól strukturalnych, ale pola bez
 * odpowiednika strukturalnego (modelAnswer arkusza — „Wzorcowa odpowiedź”)
 * zostają tekstem z tabelą; renderer dzieli je tu na segmenty tekst/tabela.
 *
 * Plik jest IDENTYCZNY w: matury-online.pl/frontend/src/lib,
 * zdaj-angielski-web/src/lib, osmoklasista-online-web/src/lib (pipe-tables.ts)
 * oraz w apkach src/utils/pipeTables.ts — przy zmianie kopiuj do wszystkich
 * i uruchom test z wektorami: matury-online.pl/frontend/src/lib/__tests__/
 * pipe-tables.test.ts albo zdaj-angielski-mobile/src/utils/__tests__/
 * pipeTables.test.ts (npx tsx <plik>).
 */

export interface StructTable {
  headers: string[];
  rows: string[][];
}

export type PipeTextSegment =
  | { kind: "text"; text: string }
  | { kind: "table"; table: StructTable };

/** Maskuje LaTeX ($$…$$, $…$), kod (```…```, `…`) i `\|` — ta sama długość, nowe linie zostają. */
function maskText(text: string): string {
  const out = text.split("");
  const blank = (a: number, b: number) => {
    for (let i = a; i < b; i++) if (out[i] !== "\n") out[i] = "x";
  };
  const patterns = [/```[\s\S]*?```/g, /\$\$[\s\S]+?\$\$/g, /`[^`\n]+`/g, /\$[^$\n]+\$/g, /\\\|/g];
  for (const re of patterns) {
    const masked = out.join("");
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      blank(m.index, m.index + m[0].length);
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out.join("");
}

const SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

type Row = { cells: string[]; bordered: boolean };

/** Dzieli linię na komórki po kreskach niezamaskowanych; null gdy to nie wiersz tabeli. */
function parseRow(line: string, maskedLine: string): Row | null {
  const t = maskedLine.trim();
  if (t.indexOf("|") < 0) return null;
  const lead = maskedLine.length - maskedLine.replace(/^\s+/, "").length;
  const end = lead + t.length;
  const bordered = t.charAt(0) === "|" && t.charAt(t.length - 1) === "|" && t.length > 1;
  const pipes: number[] = [];
  for (let i = lead; i < end; i++) if (maskedLine[i] === "|") pipes.push(i);
  const cuts = bordered ? pipes : [lead - 1, ...pipes, end];
  const cells: string[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) cells.push(line.slice(cuts[k] + 1, cuts[k + 1]).trim());
  if (bordered ? cells.length < 2 : cells.length < 3) return null;
  return { cells, bordered };
}

type Block = { start: number; end: number; table: StructTable | null };

function findBlocks(lines: string[], mlines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const first = parseRow(lines[i], mlines[i]);
    if (!first) {
      i++;
      continue;
    }
    const rows: Row[] = [first];
    let j = i + 1;
    let sawSeparator = false;
    for (; j < lines.length; j++) {
      const mt = mlines[j].trim();
      if (rows.length === 1 && !sawSeparator && SEPARATOR.test(mt) && mt.indexOf("-") >= 0) {
        sawSeparator = true;
        continue;
      }
      const r = parseRow(lines[j], mlines[j]);
      if (!r) break;
      rows.push(r);
    }
    if (rows.length < 2) {
      i++;
      continue;
    }
    let cellRows = rows.map((r) => r.cells);
    if (rows.every((r) => !r.bordered) && cellRows.every((c) => /^[^:]+:\s+\S/.test(c[0]))) {
      cellRows = cellRows.map((c) => {
        const k = c[0].indexOf(":");
        return [c[0].slice(0, k).trim(), c[0].slice(k + 1).trim(), ...c.slice(1)];
      });
    }
    const width = cellRows[0].length;
    const irregular =
      cellRows.some((c) => c.length !== width) || cellRows.every((c) => c.every((x) => x === ""));
    blocks.push({ start: i, end: j, table: irregular ? null : { headers: cellRows[0], rows: cellRows.slice(1) } });
    i = j;
  }
  return blocks;
}

/**
 * Tekst → segmenty w kolejności: tekst / tabela. Bez tabel (albo gdy blok jest
 * nieregularny) — jeden segment tekstowy z oryginałem bez zmian. Segmenty
 * tekstowe tracą tylko puste linie na brzegach (tabela to osobny blok).
 */
export function splitPipeTableSegments(text: string): PipeTextSegment[] {
  if (typeof text !== "string") return [];
  if (text.indexOf("|") < 0) return text ? [{ kind: "text", text }] : [];
  const lines = text.split("\n");
  const mlines = maskText(text).split("\n");
  const tables = findBlocks(lines, mlines).filter((b) => b.table);
  if (!tables.length) return text ? [{ kind: "text", text }] : [];

  const segs: PipeTextSegment[] = [];
  const pushText = (a: number, b: number) => {
    const s = lines
      .slice(a, b)
      .join("\n")
      .replace(/^(?:[ \t\r]*\n)+/, "")
      .replace(/(?:\n[ \t\r]*)+$/, "");
    if (s.trim()) segs.push({ kind: "text", text: s });
  };
  let pos = 0;
  for (const b of tables) {
    pushText(pos, b.start);
    segs.push({ kind: "table", table: b.table as StructTable });
    pos = b.end;
  }
  pushText(pos, lines.length);
  return segs;
}

/** Czy tekst zawiera tabelę do wyrysowania (bloki nieregularne się nie liczą). */
export function hasRenderablePipeTable(text: unknown): boolean {
  return typeof text === "string" && splitPipeTableSegments(text).some((s) => s.kind === "table");
}

export function isStructTable(t: any): t is StructTable {
  return (
    !!t &&
    Array.isArray(t.headers) &&
    Array.isArray(t.rows) &&
    t.headers.every((h: any) => typeof h === "string") &&
    t.rows.every((r: any) => Array.isArray(r) && r.every((c: any) => typeof c === "string"))
  );
}
