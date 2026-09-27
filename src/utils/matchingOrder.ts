// Kolejność prawej kolumny w zadaniach „Dopasuj” — kopia 1:1
// matury-online.pl backend/src/services/matching-order.ts (27.09.2026). Żadna poprawna
// odpowiedź nie stoi na wysokości swojego elementu, kolejność stała dla
// pytania. Zastępuje `sort(() => Math.random() - 0.5)`, które przy 3 parach
// zostawiało kolejność klucza w 25% przypadków („a-1, b-2, c-3”).

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

/**
 * `rightsInKeyOrder[i]` to poprawna odpowiedź dla i-tego elementu lewej
 * kolumny. Zwraca te same wartości w kolejności, w której żadna nie stoi na
 * swoim indeksie (dla n ≥ 2), stałej dla danego `seedText`.
 */
export function matchingOptionOrder(rightsInKeyOrder: string[], seedText: string): string[] {
  const n = rightsInKeyOrder.length;
  if (n < 2) return [...rightsInKeyOrder];
  const rand = mulberry32(hashSeed(seedText + "|" + rightsInKeyOrder.join("|")));
  for (let attempt = 0; attempt < 50; attempt++) {
    const idx = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    // Ta sama wartość po obu stronach (duplikat) też liczy się jako „na miejscu”.
    if (idx.every((k, pos) => rightsInKeyOrder[k] !== rightsInKeyOrder[pos])) {
      return idx.map((k) => rightsInKeyOrder[k]);
    }
  }
  // Awaryjnie (np. same duplikaty): przesunięcie o jeden.
  return rightsInKeyOrder.map((_, i) => rightsInKeyOrder[(i + 1) % n]);
}
