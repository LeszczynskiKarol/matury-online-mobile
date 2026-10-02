// ============================================================================
// Nazwa przedmiotu w dopełniaczu („arkusze z …”, „quizy z …”) — ręcznie, jak
// web UnlockQuizBox („z WOS”, „z Biznes i zarządzanie” psuły automatyczną
// odmianę). Klucz = slug bez sufiksu ścieżki (-osmoklasista, -fce, -cae).
// ============================================================================

const GENITIVE: Record<string, string> = {
  polski: "języka polskiego",
  matematyka: "matematyki",
  angielski: "języka angielskiego",
  niemiecki: "języka niemieckiego",
  biologia: "biologii",
  chemia: "chemii",
  fizyka: "fizyki",
  geografia: "geografii",
  historia: "historii",
  "historia-sztuki": "historii sztuki",
  wos: "WOS-u",
  informatyka: "informatyki",
  filozofia: "filozofii",
  "biznes-zarzadzanie": "biznesu i zarządzania",
};

export function subjectGenitive(
  slug: string | null | undefined,
  fallback = "tego przedmiotu",
): string {
  if (!slug) return fallback;
  const base = slug.replace(/-osmoklasista$/, "").replace(/-(fce|cae)$/, "");
  return GENITIVE[base] ?? fallback;
}
