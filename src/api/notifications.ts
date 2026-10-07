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

// ── Centrum komunikatów (7.10.2026): pełna lista „Powiadomienia” ──────────
// GET /api/notifications?limit=&cursor= — historia z isRead i url (link do
// ekranu jako ścieżka webowa). Bez `limit` endpoint zachowuje się po staremu
// (otwarte powiadomienia do karty płatności na pulpicie).

export interface NotificationListItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  isRead: boolean;
  sentAt: string;
}

export interface NotificationPage {
  items: NotificationListItem[];
  nextCursor: string | null;
  unreadCount: number | null;
}

/** Tolerancyjnie wobec kształtu odpowiedzi (items / notifications, url w data). */
export async function listNotifications(params: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<NotificationPage> {
  // Bez URLSearchParams.set — w React Native to polyfill bez pełnego API.
  let qs = `limit=${params.limit ?? 20}`;
  if (params.cursor) qs += `&cursor=${encodeURIComponent(params.cursor)}`;
  const r = await api<any>(`/notifications?${qs}`);
  const raw: any[] = r?.items ?? r?.notifications ?? [];
  const items: NotificationListItem[] = raw.map((n) => ({
    id: String(n.id),
    type: n.type,
    title: n.title ?? "",
    body: n.body ?? "",
    url: n.url ?? n.data?.url ?? null,
    isRead: Boolean(n.isRead ?? n.readAt),
    sentAt: n.sentAt ?? n.createdAt,
  }));
  return {
    items,
    nextCursor: r?.nextCursor ?? null,
    unreadCount:
      typeof r?.unread === "number"
        ? r.unread
        : typeof r?.unreadCount === "number"
          ? r.unreadCount
          : null,
  };
}

export function markAllNotificationsRead(): Promise<unknown> {
  return api("/notifications/read-all", { method: "POST" });
}

export function markNotificationRead(id: string): Promise<unknown> {
  return api(`/notifications/${id}/read`, { method: "POST" });
}

/** Zgłoszenie otwarcia pusha (Historia w panelu admina) — nigdy nie rzuca. */
export async function reportPushOpened(deliveryId: unknown): Promise<void> {
  if (typeof deliveryId !== "string" || !deliveryId) return;
  try {
    await api("/push/opened", { method: "POST", body: { deliveryId } });
  } catch {}
}
