// ============================================================================
// Szerokości kolumn tabel — jedno miejsce dla całej apki
// src/lib/tableWidths.ts
//
// React Native nie ma `<table>`, więc tabela to wiersze z Views. Gdy komórki
// mają tylko `minWidth`, każdy wiersz dobiera szerokość osobno: nagłówek
// szeroki, komórka z krótką treścią wąska — kolumny przestają trzymać jedną
// linię i wygląda to jak dwie wartości w jednej kolumnie (zgłoszenia
// 17.09.2026: materiały w arkuszu, potem pytania z tabelą w quizie).
//
// Szerokość liczymy RAZ dla całej tabeli, z najdłuższej treści w kolumnie
// (wliczając nagłówek). Bez pomiaru tekstu — szacujemy z liczby znaków, bo
// pomiar w RN jest asynchroniczny i wymagałby dwóch przebiegów renderowania.
// Sufit sprawia, że długie opisy zawijają się w kolumnie, zamiast rozpychać
// tabelę; poziome przewijanie zostaje.
// ============================================================================

export interface TableWidthOpts {
  /** Szerokość znaku w px — zależy od fontSize komórek (11-12 px → ~6). */
  charPx?: number;
  /** Minimum dla pierwszej kolumny (zwykle nazwa/etykieta). */
  firstMin?: number;
  /** Minimum dla pozostałych kolumn. */
  min?: number;
  /** Sufit dla pierwszej kolumny. */
  firstMax?: number;
  /** Sufit dla pozostałych kolumn. */
  max?: number;
}

export function tableColWidths(
  headers: unknown[],
  rows: unknown[][],
  opts: TableWidthOpts = {},
): number[] {
  const charPx = opts.charPx ?? 6;
  const firstMin = opts.firstMin ?? 120;
  const min = opts.min ?? 64;
  const firstMax = opts.firstMax ?? 230;
  const max = opts.max ?? 190;

  const safeRows = Array.isArray(rows) ? rows : [];
  const colCount = Math.max(
    Array.isArray(headers) ? headers.length : 0,
    ...(safeRows.length
      ? safeRows.map((r) => (Array.isArray(r) ? r.length : 0))
      : [0]),
  );

  return Array.from({ length: colCount }, (_, i) => {
    const texts = [
      Array.isArray(headers) ? headers[i] : "",
      ...safeRows.map((r) => (Array.isArray(r) ? r[i] : "")),
    ].map((v) => String(v ?? ""));
    const chars = texts.reduce((m, s) => Math.max(m, s.length), 0);
    // Najdłuższe SŁOWO musi się zmieścić bez łamania w środku wyrazu.
    const longestWord = texts.reduce(
      (m, s) => s.split(/\s+/).reduce((n, w) => Math.max(n, w.length), m),
      0,
    );
    const wanted = Math.max(
      chars * charPx + 22,
      longestWord * (charPx + 0.6) + 22,
      i === 0 ? firstMin : min,
    );
    return Math.round(Math.min(wanted, i === 0 ? firstMax : max));
  });
}
