// Kolejność prawej kolumny w zadaniach „Dopasuj” i kolejność startowa w
// „Ułóż w kolejności” — kopia 1:1 (od `function hashSeed`)
// matury-online.pl backend/src/services/matching-order.ts (28.09.2026). Jednostajnie losowa
// permutacja, stała dla pytania; dla n ≥ 3 odrzucona tylko kolejność klucza,
// dla n = 2 bez odrzucania. (27.09 był tu nieporządek — żadna odpowiedź na
// wysokości swojego elementu — co samo w sobie podpowiadało: przy 3 parach
// komplet z szansą 1/2, przy 2 parach klucz wprost.)

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates na indeksach 0..n-1 — jednostajny rozkład permutacji. */
function shuffledIndices(n: number, rand: () => number): number[] {
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/**
 * `rightsInKeyOrder[i]` to poprawna odpowiedź dla i-tego elementu lewej
 * kolumny. Zwraca te same wartości w losowej (jednostajnie), stałej dla
 * danego `seedText` kolejności. Dla n ≥ 3 odrzucana jest wyłącznie kolejność
 * klucza (identyczność); dla n = 2 obie kolejności są dopuszczalne — odrzucenie
 * identyczności zdradzałoby tam cały klucz.
 */
export function matchingOptionOrder(rightsInKeyOrder: string[], seedText: string): string[] {
  const n = rightsInKeyOrder.length;
  if (n < 2) return [...rightsInKeyOrder];
  const rand = mulberry32(hashSeed(seedText + "|" + rightsInKeyOrder.join("|")));
  for (let attempt = 0; attempt < 64; attempt++) {
    const out = shuffledIndices(n, rand).map((k) => rightsInKeyOrder[k]);
    // Porównanie po wartościach: przy duplikatach „inna” permutacja indeksów
    // może dać dokładnie kolejność klucza — to też odrzucamy.
    if (n === 2 || out.some((v, pos) => v !== rightsInKeyOrder[pos])) return out;
  }
  // Awaryjnie (same duplikaty): przesunięcie o jeden.
  return rightsInKeyOrder.map((_, i) => rightsInKeyOrder[(i + 1) % n]);
}

/**
 * Kolejność startowa w zadaniach „Ułóż w kolejności”: `keys` to identyfikatory
 * elementów w kolejności zapisu (ORDERING: indeksy `items`, PROOF_ORDER: `id`
 * kroków), `correctOrder` — klucz w tym samym formacie (albo brak, gdy klient
 * dostał treść bez klucza). Zwraca permutację `keys` losową (jednostajnie),
 * stałą dla `seedText`, różną od `correctOrder` dla n ≥ 3 (bez klucza — różną
 * od kolejności zapisu). Dla n = 2 bez odrzucania, jak w dopasowaniach.
 */
export function orderingDisplayOrder<T extends string | number>(
  keys: T[],
  correctOrder: unknown,
  seedText: string,
): T[] {
  const n = keys.length;
  if (n < 2) return [...keys];
  const avoid: unknown[] =
    Array.isArray(correctOrder) && correctOrder.length === n ? correctOrder : keys;
  const rand = mulberry32(hashSeed("order|" + seedText));
  for (let attempt = 0; attempt < 64; attempt++) {
    const out = shuffledIndices(n, rand).map((k) => keys[k]);
    if (n === 2 || out.some((v, pos) => v !== avoid[pos])) return out;
  }
  return keys.map((_, i) => keys[(i + 1) % n]);
}

const itemText = (x: any): string =>
  x && typeof x === "object" ? String(x.text ?? "") : String(x ?? "");

/**
 * Kolejność startowa dla treści pytania. `kind`: "items" (ORDERING — wynik to
 * indeksy `items`, format odpowiedzi) albo "steps" (PROOF_ORDER — `id` kroków).
 * Pierwszeństwo ma `content.displayOrder` od serwera (liczony z kluczem, którego
 * klient bez Premium / z X-Answer-Reveal nie dostaje) — o ile to permutacja.
 */
export function orderingInitialOrder(content: any, kind: "items" | "steps"): Array<number | string> {
  const list: any[] = Array.isArray(content?.[kind]) ? content[kind] : [];
  const keys: Array<number | string> =
    kind === "items" ? list.map((_, i) => i) : list.map((s: any) => s?.id);
  const given = content?.displayOrder;
  if (
    Array.isArray(given) &&
    given.length === keys.length &&
    keys.every((k) => given.includes(k)) &&
    new Set(given).size === given.length
  ) {
    return [...given];
  }
  const seed =
    kind === "items"
      ? "items|" + list.map(itemText).join("|")
      : "steps|" + list.map((s: any) => `${s?.id}:${itemText(s)}`).join("|");
  return orderingDisplayOrder(keys, content?.correctOrder, seed);
}
