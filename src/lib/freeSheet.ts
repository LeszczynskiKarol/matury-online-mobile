// ============================================================================
// Darmowy arkusz — wybór przedmiotu i poziomu PRZED odebraniem oferty
// src/lib/freeSheet.ts
//
// Port mechanizmu z webu (/darmowy-arkusz/<przedmiot>, 29.09.2026): uczeń
// najpierw wybiera przedmiot (i poziom, gdy są dwa), dopiero potem oferta się
// odbiera, a arkusz tego przedmiotu otwiera się od razu — bez drugiego wyboru
// w katalogu Egzaminu Live.
//
// Lista przedmiotów i poziomów idzie na żywo z GET /api/public/free-sheet
// (marka z nagłówka klienta API): tylko to, co ma dziś arkusze w puli
// darmowej oferty, więc wybór nie spali oferty na przedmiocie bez arkuszy.
// Który konkretnie arkusz — i tak losuje backend przy starcie (trial-pick.ts).
// ============================================================================

import { api } from "../api/client";
import { getAvailableExams } from "../api/exams";

export type FreeLevel = "PODSTAWOWY" | "ROZSZERZONY";

export interface FreeSheetLevel {
  level: FreeLevel;
  count: number;
  timeMinutes: number;
  maxPoints: number;
  aiGraded: boolean;
  parts: { name: string; maxPoints: number }[];
}

export interface FreeSheetSubject {
  /** Id przedmiotu (backend od 67e822e) — do POST /exams/available. */
  id?: string;
  slug: string;
  name: string;
  icon: string | null;
  count: number;
  levels: FreeSheetLevel[];
}

/** Teksty przedmiotu tej marki. `from` = to, co idzie po „darmowy arkusz ”. */
const SUBJECT_TEXT: Record<string, { name: string; from: string; icon: string; loc?: string }> = {
  polski: { name: "Język polski", from: "z polskiego", icon: "📚" },
  matematyka: { name: "Matematyka", from: "z matematyki", icon: "📐" },
  angielski: { name: "Język angielski", from: "z angielskiego", icon: "🇬🇧" },
  niemiecki: { name: "Język niemiecki", from: "z niemieckiego", icon: "🇩🇪" },
  biologia: { name: "Biologia", from: "z biologii", icon: "🧬" },
  chemia: { name: "Chemia", from: "z chemii", icon: "⚗️" },
  fizyka: { name: "Fizyka", from: "z fizyki", icon: "⚛️" },
  geografia: { name: "Geografia", from: "z geografii", icon: "🌍" },
  historia: { name: "Historia", from: "z historii", icon: "🏛️" },
  wos: { name: "WOS", from: "z WOS-u", icon: "⚖️" },
  informatyka: { name: "Informatyka", from: "z informatyki", icon: "💻" },
  "biznes-zarzadzanie": { name: "Biznes i zarządzanie", from: "z biznesu i zarządzania", icon: "💼" },
};

/** „na maturze” / „na egzaminie” — do zdania o budowie arkusza. */
export function examLoc(s: FreeSheetSubject): string {
  return SUBJECT_TEXT[s.slug]?.loc ?? "na maturze";
}

export function subjectName(s: FreeSheetSubject): string {
  return SUBJECT_TEXT[s.slug]?.name ?? s.name;
}
export function subjectFrom(s: FreeSheetSubject): string {
  return SUBJECT_TEXT[s.slug]?.from ?? `— ${s.name}`;
}
export function subjectIcon(s: FreeSheetSubject): string {
  return SUBJECT_TEXT[s.slug]?.icon ?? s.icon ?? "📝";
}

export const LEVEL_SHORT: Record<FreeLevel, string> = { PODSTAWOWY: "PP", ROZSZERZONY: "PR" };
export const LEVEL_LABEL: Record<FreeLevel, string> = {
  PODSTAWOWY: "poziom podstawowy",
  ROZSZERZONY: "poziom rozszerzony",
};
export const LEVEL_LOC: Record<FreeLevel, string> = {
  PODSTAWOWY: "na poziomie podstawowym",
  ROZSZERZONY: "na poziomie rozszerzonym",
};

export async function getFreeSheet(): Promise<FreeSheetSubject[]> {
  const res = await api<{ subjects?: FreeSheetSubject[] }>("/public/free-sheet");
  return Array.isArray(res?.subjects) ? res.subjects : [];
}

/** Id przedmiotu: z free-sheet, a ze starszego backendu — z /subjects. */
async function subjectIdOf(s: FreeSheetSubject): Promise<string | null> {
  if (s.id) return s.id;
  const subs = await api<any[]>("/subjects").catch(() => []);
  return (Array.isArray(subs) ? subs : []).find((x: any) => x.slug === s.slug)?.id ?? null;
}

/**
 * Najnowszy nieprzerobiony arkusz przedmiotu i poziomu (jak web: findExamId
 * w TrialClaimLanding). Wymaga odebranej oferty — /exams/available jest za
 * requirePremiumOrTrial.
 */
export async function findFreeExam(
  s: FreeSheetSubject,
  level: FreeLevel,
): Promise<{ examId: string; subjectId: string } | null> {
  const subjectId = await subjectIdOf(s);
  if (!subjectId) return null;
  const data: any = await getAvailableExams(subjectId, level);
  const pool: any[] = data?.exams ?? [];
  const newest = (list: any[]) =>
    list.reduce<any>((m, e) => (!m || (e.examNumber ?? 0) > (m.examNumber ?? 0) ? e : m), null);
  const exam = newest(pool.filter((e) => !e.completed)) || newest(pool);
  return exam?.id ? { examId: exam.id, subjectId } : null;
}

/** Numer z puli („Arkusz maturalny #3 — …”) nic uczniowi nie mówi. */
export function stripSheetNumber(title: string): string {
  return title.replace(/\s*#\d+/, "").replace(/\s{2,}/g, " ").trim();
}

/** Separator tysięcy = spacja nierozdzielająca (1 234). */
export function formatThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function arkuszeWord(n: number): string {
  if (n === 1) return "arkusz";
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? "arkusze" : "arkuszy";
}

export function punktyWord(n: number): string {
  if (n === 1) return "punkt";
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? "punkty" : "punktów";
}

/** Liczbę arkuszy pokazujemy dopiero od progu (jak web: EXAM_COUNT_MIN_SHOWN). */
export const COUNT_MIN_SHOWN = 10;

// ── Teksty stanu konta — identyczne z webem (FreeSheetState.astro) ──────────
export const FS_NOTE_CLAIMABLE =
  "Jeden arkusz na konto — wybierz przedmiot, na którym zależy Ci najbardziej.";
/** Wybór w tej marce: przedmiot. */
export const FS_PICK_TITLE = "Wybierz przedmiot";
export const FS_PICK_BACK = "← Inny przedmiot";
export const FS_PICK_CTA = "Wybieram przedmiot →";
export const FS_CTA_OPEN = "Masz już swój darmowy arkusz — otwórz →";
export const FS_CTA_RESULT = "Masz już swój darmowy arkusz — zobacz wynik →";
export const FS_CTA_PREMIUM_USER = "Masz Premium — przejdź do arkuszy →";
export const FS_CTA_UNAVAILABLE = "Zobacz Premium →";
export const FS_MSG_EXPIRED =
  "Minęło 48 godzin na otwarcie darmowego arkusza, a oferta jest jedna na konto.";
export const FS_MSG_NOT_ELIGIBLE =
  "Darmowy arkusz przysługuje kontom, które nie miały jeszcze dostępu Premium.";

export function ctaClaim(s: FreeSheetSubject): string {
  return `Odbierz darmowy arkusz ${subjectFrom(s)} →`;
}
