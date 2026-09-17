// ============================================================================
// src/api/notifications.ts — powiadomienia in-app (np. nieudana płatność)
//
// Kontrakt: GET /api/notifications → tylko nierozwiązane i niezamknięte
// (resolvedAt IS NULL AND dismissedAt IS NULL), max 20, najnowsze pierwsze.
// POST /api/notifications/:id/dismiss → { dismissed: true }.
// ============================================================================

import { api } from "./client";

export type NotificationType = "PAYMENT_FAILED" | (string & {});

export interface PaymentFailedData {
  invoiceId: string;
  /** Link do faktury (web). W apce NIE używamy — polityka płatności Google Play. */
  payUrl: string | null;
  amountZl: number;
  retryAt: string | null;
  final: boolean;
  provider: "stripe";
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: PaymentFailedData | Record<string, unknown> | null;
  sentAt: string;
}

export function getNotifications(): Promise<{ notifications: AppNotification[] }> {
  return api<{ notifications: AppNotification[] }>("/notifications");
}

export function dismissNotification(id: string): Promise<{ dismissed: boolean }> {
  return api<{ dismissed: boolean }>(`/notifications/${id}/dismiss`, {
    method: "POST",
  });
}
