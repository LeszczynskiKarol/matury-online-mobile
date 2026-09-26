// ============================================================================
// Poziomy trudności — jedna, opisowa skala dla setupu sesji i filtrów.
// Backend trzyma Question.difficulty 1–5; cyfry nic uczniowi nie mówią,
// więc wszędzie w UI pokazujemy etykietę i krótki opis.
// ============================================================================

export interface DifficultyLevel {
  value: number;
  label: string;
  /** Do czego ten poziom przygotowuje — pokazywane w setupie. */
  desc: string;
  color: string;
}

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { value: 1, label: "Łatwe", desc: "rozgrzewka, podstawy", color: "#22c55e" },
  { value: 2, label: "Podstawa", desc: "matura podstawowa", color: "#0ea5e9" },
  { value: 3, label: "Średnie", desc: "solidna podstawa / B1+", color: "#f59e0b" },
  { value: 4, label: "Trudne", desc: "matura rozszerzona", color: "#f97316" },
  { value: 5, label: "Ekspert", desc: "rozszerzona na 90%+ / C1", color: "#ef4444" },
];

export const difficultyLabel = (d: number) =>
  DIFFICULTY_LEVELS.find((l) => l.value === d)?.label ?? String(d);
export const difficultyColor = (d: number) =>
  DIFFICULTY_LEVELS.find((l) => l.value === d)?.color ?? "#71717a";
