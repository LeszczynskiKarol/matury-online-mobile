// ============================================================================
// Adresy komórek arkusza ($B$2, $A1, B$7, $A$1:$C$10) a LaTeX.
// src/utils/cellRefs.ts — kopia 1:1 z matury-online.pl frontend/src/lib/cell-refs.ts
// (także weby zdaj/osmo i pozostałe apki).
//
// Renderery traktują `$…$` jako wzór, więc „=SUMA($B$2:$B$10)” w zadaniu
// z arkusza kalkulacyjnego zamieniało się we wzór „B” i gubiło dolary. Przed
// wydzieleniem wzorów podmieniamy `$` w adresach komórek na znak zastępczy,
// a po renderze prozy przywracamy.
//
// Adres = opcjonalny `$`, 1–3 WIELKIE litery kolumny, opcjonalny `$`, numer
// wiersza — z co najmniej jednym `$`. Nie ruszamy:
//   - `\$A\$1` (escapowany dolar wewnątrz wzoru — to już działa),
//   - adresu, po którym stoi `$` („$A1$” może być wzorem A1),
//   - fragmentów sklejonych z literami/cyframi z obu stron.
// ============================================================================

export const CELL_DOLLAR = "";

const CELL_REF_RE = /(^|[^\w$\\])(\$?[A-Z]{1,3}\$?[0-9]{1,7})(?![\w$])/g;

/** `$` w adresach komórek → CELL_DOLLAR (reszta tekstu bez zmian). */
export function protectCellRefs(text: string): string {
  if (!text || !text.includes("$")) return text;
  return text.replace(CELL_REF_RE, (m, pre: string, ref: string) =>
    ref.includes("$") ? pre + ref.replace(/\$/g, CELL_DOLLAR) : m,
  );
}

/** Odwrotność protectCellRefs — przywraca `$`. */
export function restoreCellRefs(text: string): string {
  return text && text.includes(CELL_DOLLAR) ? text.split(CELL_DOLLAR).join("$") : text;
}
