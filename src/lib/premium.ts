// ============================================================================
// Czy status subskrypcji daje dostęp Premium — lustro backend/services/premium.ts
// (isPremiumActive), bez roli ADMIN, którą obsługuje sam serwer w /stripe/status.
//
// Do 1.0.19 ta reguła siedziała w AuthContext jako zamknięta lista
// ACTIVE | ONE_TIME i nie znała statusu ANNUAL (Pakiet Maturalny, od 2.09.2026):
// klientka po zakupie na webie widziała w apce paywall. Backend do wersji
// 1.0.19 udaje przed apką ONE_TIME (compatSubscriptionStatus); od 1.0.20
// dostajemy prawdziwy status i musimy go rozumieć tutaj.
// ============================================================================

export type SubscriptionStatus =
  | "FREE"
  | "ACTIVE"
  | "ONE_TIME"
  | "ANNUAL"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";

export function isPremiumStatus(
  status: string | null | undefined,
  subscriptionEnd: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const end = subscriptionEnd ? new Date(subscriptionEnd) : null;
  const endValid = !!end && Number.isFinite(end.getTime());
  switch ((status ?? "").toUpperCase()) {
    // Serwer daje ACTIVE karencję po dacie końca (zgubiony webhook) — tu nie
    // odcinamy po dacie, żeby apka nie była surowsza od serwera.
    case "ACTIVE":
      return true;
    // Opłacony okres trwa do subscriptionEnd — także po anulowaniu.
    case "ONE_TIME":
    case "ANNUAL":
    case "CANCELLED":
      return endValid && end!.getTime() > now.getTime();
    default:
      return false;
  }
}

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  FREE: "Darmowe",
  ACTIVE: "Premium",
  ONE_TIME: "Premium (30 dni)",
  ANNUAL: "Premium (Pakiet Maturalny)",
  PAST_DUE: "Zaległa płatność",
  CANCELLED: "Anulowane",
  EXPIRED: "Wygasło",
};
